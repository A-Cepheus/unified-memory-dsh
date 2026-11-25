import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  ClaudeCodeExternalApprovalState,
  ClaudeMergedSettings,
  ClaudeProjectResolution,
  ClaudeProjectSummary,
} from '../types.js';

export function canonicalizeFsPath(filePath: string): string {
  const expanded = expandHome(filePath.trim());
  const resolved = path.resolve(expanded);
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

export function resolveGitTopLevel(dirPath: string): string | null {
  const normalized = path.resolve(dirPath);
  if (!fs.existsSync(normalized)) return null;
  let targetDir = normalized;
  try {
    if (fs.statSync(normalized).isFile()) {
      targetDir = path.dirname(normalized);
    }
  } catch {
    return null;
  }
  try {
    const topLevel = execFileSync('git', ['-C', targetDir, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      timeout: 1500,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!topLevel) return null;
    return canonicalizeFsPath(topLevel);
  } catch {
    return null;
  }
}

export function getClaudeStateFilePath(
  claudeConfigDir: string = getClaudeConfigDir(),
  homeDir: string = os.homedir(),
): string {
  const defaultConfigDir = path.join(homeDir, '.claude');
  if (path.resolve(claudeConfigDir) !== path.resolve(defaultConfigDir)) {
    return path.join(claudeConfigDir, '.claude.json');
  }
  return path.join(homeDir, '.claude.json');
}

export function getClaudeConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.CLAUDE_CONFIG_DIR?.trim();
  if (configured) {
    return expandHome(configured);
  }
  return path.join(os.homedir(), '.claude');
}

export function expandHome(filePath: string): string {
  if (filePath === '~') return os.homedir();
  if (filePath.startsWith('~/') || filePath.startsWith('~\\')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Deterministic radix-36 hash matching Claude Code's >200-char slug overflow suffix.
 */
export function simpleHashBase36(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Exact Claude Code project slug encoding (empirically verified 8/8 on real
 * macOS paths containing '/', '.', '_', and spaces).
 */
export function encodeClaudeProjectSlug(absPath: string): string {
  const normalized = path.resolve(absPath);
  const sanitized = normalized.replace(/[^a-zA-Z0-9]/g, '-');
  if (sanitized.length <= 200) {
    return sanitized;
  }
  return `${sanitized.slice(0, 200)}-${simpleHashBase36(normalized)}`;
}

/**
 * Resolves the canonical main repository root for Git worktrees using
 * `git rev-parse --git-common-dir`, matching Claude Code's worktree sharing behavior.
 */
export function resolveGitMainRoot(dirPath: string): {
  root: string;
  gitCommonDir?: string;
  isGitWorktree: boolean;
} {
  const normalized = path.resolve(dirPath);
  if (!fs.existsSync(normalized)) {
    return { root: normalized, isGitWorktree: false };
  }
  let targetDir = normalized;
  try {
    if (fs.statSync(normalized).isFile()) {
      targetDir = path.dirname(normalized);
    }
  } catch {
    return { root: normalized, isGitWorktree: false };
  }

  try {
    const topLevel = execFileSync('git', ['-C', targetDir, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      timeout: 1500,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    const commonDirRaw = execFileSync(
      'git',
      ['-C', targetDir, 'rev-parse', '--git-common-dir'],
      {
        encoding: 'utf8',
        timeout: 1500,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();

    const gitDirRaw = execFileSync('git', ['-C', targetDir, 'rev-parse', '--git-dir'], {
      encoding: 'utf8',
      timeout: 1500,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    const canonical = (p: string): string => {
      try {
        return fs.realpathSync(p);
      } catch {
        return path.resolve(p);
      }
    };

    const resolvedTop = canonical(topLevel);
    const resolvedCommon = canonical(
      path.isAbsolute(commonDirRaw) ? commonDirRaw : path.resolve(targetDir, commonDirRaw),
    );
    const resolvedGitDir = canonical(
      path.isAbsolute(gitDirRaw) ? gitDirRaw : path.resolve(targetDir, gitDirRaw),
    );

    const isGitWorktree = resolvedCommon !== resolvedGitDir;
    if (path.basename(resolvedCommon) === '.git') {
      return {
        root: path.dirname(resolvedCommon),
        gitCommonDir: resolvedCommon,
        isGitWorktree,
      };
    }

    return {
      root: resolvedTop,
      gitCommonDir: resolvedCommon,
      isGitWorktree,
    };
  } catch {
    return { root: targetDir, isGitWorktree: false };
  }
}

function safeReadJsonObject(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Reads only memory/rules configuration keys from Claude Code settings files.
 * Never reads or returns secrets from `env` or auth fields.
 */
export function readClaudeSettings(
  projectRoot?: string,
  claudeConfigDir: string = getClaudeConfigDir(),
  env: NodeJS.ProcessEnv = process.env,
): ClaudeMergedSettings {
  const files: string[] = [
    path.join(claudeConfigDir, 'settings.json'),
    path.join(claudeConfigDir, 'settings.local.json'),
  ];
  if (projectRoot) {
    files.push(
      path.join(projectRoot, '.claude', 'settings.json'),
      path.join(projectRoot, '.claude', 'settings.local.json'),
    );
  }

  let autoMemoryEnabled = true;
  let autoMemoryDirectory: string | undefined;
  const excludeSet = new Set<string>();

  for (const file of files) {
    const obj = safeReadJsonObject(file);
    if (!obj) continue;

    if (typeof obj.autoMemoryEnabled === 'boolean') {
      autoMemoryEnabled = obj.autoMemoryEnabled;
    }
    if (typeof obj.autoMemoryDirectory === 'string' && obj.autoMemoryDirectory.trim()) {
      autoMemoryDirectory = expandHome(obj.autoMemoryDirectory.trim());
    }
    if (Array.isArray(obj.claudeMdExcludes)) {
      for (const item of obj.claudeMdExcludes) {
        if (typeof item === 'string' && item.trim()) {
          excludeSet.add(item.trim());
        }
      }
    }
  }

  const disabledEnvRaw = (env.CLAUDE_CODE_DISABLE_AUTO_MEMORY ?? '').trim().toLowerCase();
  const disabledByEnv = disabledEnvRaw === '1' || disabledEnvRaw === 'true';

  return {
    autoMemoryEnabled: disabledByEnv ? false : autoMemoryEnabled,
    autoMemoryDirectory,
    claudeMdExcludes: Array.from(excludeSet),
    disabledByEnv,
  };
}

export function resolveClaudeProject(
  inputPath: string,
  options?: {
    claudeConfigDir?: string;
    env?: NodeJS.ProcessEnv;
  },
): ClaudeProjectResolution {
  const claudeConfigDir = options?.claudeConfigDir ?? getClaudeConfigDir(options?.env);
  const env = options?.env ?? process.env;
  const gitInfo = resolveGitMainRoot(inputPath);
  const settings = readClaudeSettings(gitInfo.root, claudeConfigDir, env);
  const slug = encodeClaudeProjectSlug(gitInfo.root);

  const memoryDir = settings.autoMemoryDirectory
    ? settings.autoMemoryDirectory
    : path.join(claudeConfigDir, 'projects', slug, 'memory');

  return {
    inputPath: path.resolve(inputPath),
    resolvedRoot: gitInfo.root,
    gitCommonDir: gitInfo.gitCommonDir,
    isGitWorktree: gitInfo.isGitWorktree,
    slug,
    memoryDir,
    autoMemoryEnabled: settings.autoMemoryEnabled,
    autoMemoryOverride: settings.autoMemoryDirectory,
    disabledByEnv: settings.disabledByEnv,
    exists: fs.existsSync(memoryDir),
  };
}

/**
 * Reads ONLY Claude Code's per-project external CLAUDE.md include approval booleans
 * (`hasClaudeMdExternalIncludesApproved`, `hasClaudeMdExternalIncludesWarningShown`)
 * from `~/.claude.json` (or `$CLAUDE_CONFIG_DIR/.claude.json`).
 * Strictly read-only; never reads tokens/secrets or modifies `.claude.json`.
 */
export function readClaudeCodeExternalApproval(
  workspaceRoot: string,
  options?: {
    claudeConfigDir?: string;
    homeDir?: string;
    claudeStateFilePath?: string;
  },
): ClaudeCodeExternalApprovalState | null {
  const homeDir = options?.homeDir ?? os.homedir();
  const claudeConfigDir = options?.claudeConfigDir ?? getClaudeConfigDir();
  const statePath =
    options?.claudeStateFilePath ?? getClaudeStateFilePath(claudeConfigDir, homeDir);
  const obj = safeReadJsonObject(statePath);
  if (!obj || !obj.projects || typeof obj.projects !== 'object' || Array.isArray(obj.projects)) {
    return null;
  }

  const projects = obj.projects as Record<string, unknown>;
  const resolvedWs = path.resolve(workspaceRoot);
  const realWs = canonicalizeFsPath(workspaceRoot);

  const extractState = (
    projKey: string,
    entry: unknown,
  ): ClaudeCodeExternalApprovalState | null => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const rec = entry as Record<string, unknown>;
    const hasApproved = typeof rec.hasClaudeMdExternalIncludesApproved === 'boolean';
    const hasWarning = typeof rec.hasClaudeMdExternalIncludesWarningShown === 'boolean';
    if (!hasApproved && !hasWarning) return null;
    return {
      approved: rec.hasClaudeMdExternalIncludesApproved === true,
      warningShown: rec.hasClaudeMdExternalIncludesWarningShown === true,
      matchedProjectKey: projKey,
    };
  };

  for (const key of [resolvedWs, realWs]) {
    if (Object.prototype.hasOwnProperty.call(projects, key)) {
      const state = extractState(key, projects[key]);
      if (state) return state;
    }
  }

  for (const [projKey, val] of Object.entries(projects)) {
    if (!projKey.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(projKey)) continue;
    const normKey = path.resolve(projKey);
    if (normKey === resolvedWs || normKey === realWs || canonicalizeFsPath(normKey) === realWs) {
      const state = extractState(projKey, val);
      if (state) return state;
    }
  }

  return null;
}

/**
 * Builds a slug -> real filesystem path lookup table from `~/.claude.json`
 * (`projects` keys only, never reading any secrets or values).
 */
export function buildKnownProjectPathMap(
  homeDir: string = os.homedir(),
): Map<string, string> {
  const map = new Map<string, string>();
  const claudeJsonPath = path.join(homeDir, '.claude.json');
  const obj = safeReadJsonObject(claudeJsonPath);
  if (obj && obj.projects && typeof obj.projects === 'object' && !Array.isArray(obj.projects)) {
    for (const projPath of Object.keys(obj.projects as Record<string, unknown>)) {
      if (projPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(projPath)) {
        map.set(encodeClaudeProjectSlug(projPath), projPath);
      }
    }
  }
  return map;
}

export function discoverAllClaudeProjects(
  claudeConfigDir: string = getClaudeConfigDir(),
  homeDir: string = os.homedir(),
): ClaudeProjectSummary[] {
  const projectsRoot = path.join(claudeConfigDir, 'projects');
  if (!fs.existsSync(projectsRoot)) return [];

  const pathMap = buildKnownProjectPathMap(homeDir);
  const entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
  const results: ClaudeProjectSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const memoryDir = path.join(projectsRoot, slug, 'memory');
    const hasMemoryDir = fs.existsSync(memoryDir);
    const indexPath = path.join(memoryDir, 'MEMORY.md');
    const hasMemoryIndex = hasMemoryDir && fs.existsSync(indexPath);

    let indexLines = 0;
    let indexBytes = 0;
    let topicCount = 0;
    let lastModifiedMs = 0;

    if (hasMemoryIndex) {
      try {
        const st = fs.statSync(indexPath);
        indexBytes = st.size;
        lastModifiedMs = Math.max(lastModifiedMs, st.mtimeMs);
        const content = fs.readFileSync(indexPath, 'utf8');
        indexLines = content === '' ? 0 : content.replace(/\r\n/g, '\n').split('\n').length;
      } catch {
        // ignore stat errors
      }
    }

    if (hasMemoryDir) {
      try {
        const memEntries = fs.readdirSync(memoryDir, { withFileTypes: true });
        for (const mf of memEntries) {
          if (!mf.isFile() || !mf.name.endsWith('.md') || mf.name === 'MEMORY.md') continue;
          topicCount++;
          try {
            const st = fs.statSync(path.join(memoryDir, mf.name));
            lastModifiedMs = Math.max(lastModifiedMs, st.mtimeMs);
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    }

    const mapped = pathMap.get(slug);
    results.push({
      slug,
      displayPath: mapped ?? slug,
      exactPathResolved: Boolean(mapped),
      memoryDir,
      hasMemoryDir,
      hasMemoryIndex,
      indexLines,
      indexBytes,
      topicCount,
      lastModifiedMs,
    });
  }

  results.sort((a, b) => b.lastModifiedMs - a.lastModifiedMs || a.slug.localeCompare(b.slug));
  return results;
}
