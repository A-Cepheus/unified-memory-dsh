import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  ApprovedExternalRuleTarget,
  BlockedExternalRuleTarget,
  ClaudeCodeExternalApprovalState,
  ClaudeRuleEntry,
  ClaudeRuleScope,
  ExternalRuleApprovalSource,
  ExternalRuleBlockStatus,
  WorkspaceExternalTrustConfig,
  WorkspaceRulesBundle,
} from '../types.js';
import { parseFrontmatter } from './frontmatter.js';
import {
  canonicalizeFsPath,
  expandHome,
  getClaudeConfigDir,
  readClaudeCodeExternalApproval,
  readClaudeSettings,
  resolveGitTopLevel,
} from './paths.js';
import { getWorkspaceExternalTrust } from '../session/state.js';

const MAX_IMPORT_DEPTH = 5;

export const DEFAULT_NATIVE_RULE_FILENAMES: readonly string[] = [
  'AGENTS.md',
  'AGENTS.local.md',
] as const;

export const DEFAULT_HOST_NAME = 'DeepSeek Harness';

/**
 * Expands simple brace expressions like `src/api/{a,b}.ts` into flat globs.
 */
export function expandBraceGlob(pattern: string): string[] {
  const match = /\{([^{}]+)\}/.exec(pattern);
  if (!match) return [pattern];
  const prefix = pattern.slice(0, match.index);
  const suffix = pattern.slice(match.index + match[0].length);
  const options = match[1].split(',');
  const results: string[] = [];
  for (const opt of options) {
    for (const expanded of expandBraceGlob(`${prefix}${opt}${suffix}`)) {
      results.push(expanded);
    }
  }
  return results;
}

/**
 * Converts a glob pattern (supporting `**`, `*`, `?`, `{a,b}`) into a RegExp
 * matching POSIX forward-slash paths.
 */
export function globToRegExp(glob: string): RegExp {
  const normalized = glob.replace(/\\/g, '/').replace(/^\.\//, '');
  let rx = '^';
  let i = 0;
  while (i < normalized.length) {
    const ch = normalized[i];
    if (ch === '*') {
      if (normalized[i + 1] === '*') {
        if (normalized[i + 2] === '/') {
          rx += '(?:.*/)?';
          i += 3;
          continue;
        }
        rx += '.*';
        i += 2;
        continue;
      }
      rx += '[^/]*';
      i++;
      continue;
    }
    if (ch === '?') {
      rx += '[^/]';
      i++;
      continue;
    }
    if ('^$.|+()[]{}'.includes(ch)) {
      rx += `\\${ch}`;
    } else {
      rx += ch;
    }
    i++;
  }
  rx += '$';
  return new RegExp(rx);
}

export function matchesGlobPatterns(targetPath: string, patterns: string[]): boolean {
  const normTarget = targetPath.replace(/\\/g, '/').replace(/^\.\//, '');
  for (const rawPattern of patterns) {
    const trimmed = rawPattern.trim();
    if (!trimmed) continue;
    for (const expanded of expandBraceGlob(trimmed)) {
      const re = globToRegExp(expanded);
      if (re.test(normTarget)) return true;
      if (!expanded.includes('/') && re.test(path.posix.basename(normTarget))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Strips HTML comments (`<!-- ... -->`) outside Markdown fenced code blocks
 * and inline code spans, matching Claude Code's CLAUDE.md token optimization.
 */
export function stripHtmlComments(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inFence = false;
  let fenceChar = '';
  let inHtmlComment = false;

  for (const line of lines) {
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
    if (!inHtmlComment && fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceChar = fenceMatch[1][0];
      } else if (fenceMatch[1][0] === fenceChar) {
        inFence = false;
        fenceChar = '';
      }
      out.push(line);
      continue;
    }

    if (inFence) {
      out.push(line);
      continue;
    }

    let result = '';
    let i = 0;
    let inInlineCode = false;

    while (i < line.length) {
      if (inHtmlComment) {
        const endIdx = line.indexOf('-->', i);
        if (endIdx === -1) {
          i = line.length;
        } else {
          inHtmlComment = false;
          i = endIdx + 3;
        }
        continue;
      }

      if (line[i] === '`') {
        inInlineCode = !inInlineCode;
        result += line[i];
        i++;
        continue;
      }

      if (!inInlineCode && line.startsWith('<!--', i)) {
        const endIdx = line.indexOf('-->', i + 4);
        if (endIdx === -1) {
          inHtmlComment = true;
          i = line.length;
        } else {
          i = endIdx + 3;
        }
        continue;
      }

      result += line[i];
      i++;
    }

    if (result.trim() !== '' || line.trim() === '') {
      out.push(result);
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function safeRealpath(filePath: string): string {
  return canonicalizeFsPath(filePath);
}

/**
 * Normalizes a host-supplied `alreadyLoadedPaths` set so both resolved and
 * realpath variants match reliably (handling macOS `/var` -> `/private/var`).
 */
function buildCanonicalPathSet(paths?: ReadonlySet<string>): Set<string> | undefined {
  if (!paths || paths.size === 0) return undefined;
  const set = new Set<string>();
  for (const p of paths) {
    if (!p || !p.trim()) continue;
    set.add(path.resolve(p));
    set.add(safeRealpath(p));
  }
  return set;
}

/**
 * User-level and managed rules are authored/controlled by the local user or machine admin
 * and are trusted for external `@import`s and symlinks (matching standard Claude Code CLI).
 * Repository-provided rules (`project`, `project_rule`, `local`, `subdir`, `ancestor`)
 * must be checked against workspace trust boundaries.
 */
export function isTrustedRuleScope(scope: ClaudeRuleScope): boolean {
  return scope === 'managed' || scope === 'user' || scope === 'user_rule';
}

export function isPathWithinRoot(targetPath: string, rootPath: string): boolean {
  const rel = path.relative(rootPath, targetPath);
  if (rel === '') return true;
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || rel.startsWith('../')) {
    return false;
  }
  if (path.isAbsolute(rel)) return false;
  return true;
}

export interface RuleExternalTrustOptions {
  claudeConfigDir?: string;
  homeDir?: string;
  claudeStateFilePath?: string;
  trustClaudeCodeExternalApprovals?: boolean;
  externalRuleTrust?: Record<string, WorkspaceExternalTrustConfig>;
}

export interface HostRuleDedupOptions {
  /** Whether to skip expanding `@import`s targeting native host instruction files inside workspace. */
  deduplicateNativeAgentsMd?: boolean;
  /** Basenames loaded natively by the host (defaults to `['AGENTS.md', 'AGENTS.local.md']`). */
  nativeRuleFilenames?: readonly string[];
  /** Human-readable host name used in internal dedup markers (defaults to `'DeepSeek Harness'`). */
  hostName?: string;
  /**
   * Canonical or resolved paths already injected natively by the host (e.g., from
   * `dsh-agent-instructions` `source.changes[]`). Matching rule files keep `dedupedByHost: true`
   * and still expand their `@import` graph into `importedOnlyContent` without duplicating raw bodies.
   */
  alreadyLoadedPaths?: ReadonlySet<string>;
}

export interface ExternalRuleTrustContext {
  workspaceRealRoot: string;
  allowedRoots: string[];
  allowPaths: string[];
  denyPaths: string[];
  trustClaudeCodeExternalApprovals: boolean;
  claudeCodeApproval: ClaudeCodeExternalApprovalState | null;
}

export type TargetAuthorizationDecision =
  | { allowed: true; internal: true }
  | { allowed: true; internal: false; approvedBy: ExternalRuleApprovalSource }
  | { allowed: false; status: ExternalRuleBlockStatus };

export function buildWorkspaceTrustContext(
  workspaceRoot: string,
  options?: RuleExternalTrustOptions,
): ExternalRuleTrustContext {
  const workspaceRealRoot = safeRealpath(workspaceRoot);
  const wsTrust = getWorkspaceExternalTrust(options?.externalRuleTrust, workspaceRoot);
  const claudeCodeApproval = readClaudeCodeExternalApproval(workspaceRoot, {
    claudeConfigDir: options?.claudeConfigDir,
    homeDir: options?.homeDir,
    claudeStateFilePath: options?.claudeStateFilePath,
  });
  return {
    workspaceRealRoot,
    allowedRoots: [workspaceRealRoot],
    allowPaths: wsTrust.allowPaths,
    denyPaths: wsTrust.denyPaths,
    trustClaudeCodeExternalApprovals: options?.trustClaudeCodeExternalApprovals ?? true,
    claudeCodeApproval,
  };
}

/**
 * Evaluates whether a canonical target path is permitted for a repository-provided rule.
 * Precedence:
 * 1. Inside allowed root(s) -> internal (allowed)
 * 2. Plugin explicit allow/deny (most specific matching path wins; deny wins on tie)
 * 3. Native Claude Code ~/.claude.json project-level approval/denial (read-only, if enabled)
 * 4. Default fail-closed -> pending_approval
 */
export function evaluateExternalTargetTrust(
  targetRealPath: string,
  trustCtx: ExternalRuleTrustContext,
): TargetAuthorizationDecision {
  for (const root of trustCtx.allowedRoots) {
    if (isPathWithinRoot(targetRealPath, root)) {
      return { allowed: true, internal: true };
    }
  }

  let bestDenyLen = -1;
  for (const denied of trustCtx.denyPaths) {
    if (isPathWithinRoot(targetRealPath, denied) && denied.length > bestDenyLen) {
      bestDenyLen = denied.length;
    }
  }

  let bestAllowPath: string | null = null;
  let bestAllowLen = -1;
  for (const allowed of trustCtx.allowPaths) {
    if (isPathWithinRoot(targetRealPath, allowed) && allowed.length > bestAllowLen) {
      bestAllowLen = allowed.length;
      bestAllowPath = allowed;
    }
  }

  if (bestDenyLen >= 0 || bestAllowLen >= 0) {
    if (bestAllowLen > bestDenyLen && bestAllowPath !== null) {
      return {
        allowed: true,
        internal: false,
        approvedBy:
          targetRealPath === bestAllowPath ? 'plugin_file_allowlist' : 'plugin_dir_allowlist',
      };
    }
    return { allowed: false, status: 'denied_by_plugin' };
  }

  if (trustCtx.trustClaudeCodeExternalApprovals && trustCtx.claudeCodeApproval) {
    if (trustCtx.claudeCodeApproval.approved) {
      return {
        allowed: true,
        internal: false,
        approvedBy: 'claude_code_project_approval',
      };
    }
    if (trustCtx.claudeCodeApproval.warningShown) {
      return { allowed: false, status: 'denied_by_claude_code' };
    }
  }

  return { allowed: false, status: 'pending_approval' };
}

function formatDisplayPath(filePath: string, workspaceRoot?: string): string {
  if (workspaceRoot) {
    const rel = path.relative(workspaceRoot, filePath);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
      return rel.replace(/\\/g, '/');
    }
    if (rel === '') return path.basename(filePath);
  }
  const home = os.homedir();
  if (filePath === home || filePath.startsWith(home + path.sep)) {
    return '~' + filePath.slice(home.length);
  }
  return filePath;
}

function dedupeBlockedTargets(items: BlockedExternalRuleTarget[]): BlockedExternalRuleTarget[] {
  const seen = new Set<string>();
  const out: BlockedExternalRuleTarget[] = [];
  for (const item of items) {
    const key = `${item.kind}|${item.sourceFile}|${item.rawRef ?? ''}|${item.resolvedTarget}|${item.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  out.sort(
    (a, b) =>
      a.sourceDisplayPath.localeCompare(b.sourceDisplayPath) ||
      a.resolvedTarget.localeCompare(b.resolvedTarget) ||
      a.kind.localeCompare(b.kind),
  );
  return out;
}

function dedupeApprovedTargets(
  items: ApprovedExternalRuleTarget[],
): ApprovedExternalRuleTarget[] {
  const seen = new Set<string>();
  const out: ApprovedExternalRuleTarget[] = [];
  for (const item of items) {
    const key = `${item.kind}|${item.sourceDisplayPath}|${item.resolvedTarget}|${item.approvedBy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  out.sort(
    (a, b) =>
      a.sourceDisplayPath.localeCompare(b.sourceDisplayPath) ||
      a.resolvedTarget.localeCompare(b.resolvedTarget) ||
      a.kind.localeCompare(b.kind),
  );
  return out;
}

export function isNativeHostRuleInWorkspace(
  resolvedPath: string,
  workspaceRoots: string[],
  nativeRuleFilenames: readonly string[] = DEFAULT_NATIVE_RULE_FILENAMES,
): boolean {
  const base = path.basename(resolvedPath);
  if (!nativeRuleFilenames.includes(base)) return false;
  for (const ws of workspaceRoots) {
    const normWs = safeRealpath(ws);
    if (isPathWithinRoot(resolvedPath, normWs)) {
      return true;
    }
  }
  return false;
}

export interface ExpandImportsResult {
  content: string;
  /** Expanded content from `@import` targets only (excluding the host file's own body). */
  importedOnlyContent: string;
  imports: string[];
  skippedDuplicateAgentsMd: string[];
  blockedExternalTargets: BlockedExternalRuleTarget[];
  approvedExternalTargets: ApprovedExternalRuleTarget[];
}

/**
 * Expands Claude Code `@path` / `@import path` references recursively up to 5 hops,
 * skipping fenced code blocks and inline backticks, with cycle detection,
 * optional workspace external-trust enforcement, and optional deduplication against
 * native workspace host rules (e.g. `AGENTS.md` / `AGENTS.local.md`) or `alreadyLoadedPaths`.
 */
export function expandAtImports(
  rawContent: string,
  sourceFilePath: string,
  options?: {
    workspaceRoot?: string;
    workspaceRoots?: string[];
    deduplicateNativeAgentsMd?: boolean;
    nativeRuleFilenames?: readonly string[];
    hostName?: string;
    alreadyLoadedPaths?: ReadonlySet<string>;
    maxDepth?: number;
    externalTrust?: ExternalRuleTrustContext;
    sourceScope?: ClaudeRuleScope;
  },
): ExpandImportsResult {
  const workspaceRoot = options?.workspaceRoot;
  const workspaceRoots = options?.workspaceRoots ?? [];
  const deduplicateNativeAgentsMd = options?.deduplicateNativeAgentsMd ?? true;
  const nativeRuleFilenames = options?.nativeRuleFilenames ?? DEFAULT_NATIVE_RULE_FILENAMES;
  const hostName = options?.hostName ?? DEFAULT_HOST_NAME;
  const canonicalLoaded = buildCanonicalPathSet(options?.alreadyLoadedPaths);
  const maxDepth = options?.maxDepth ?? MAX_IMPORT_DEPTH;
  const externalTrust = options?.externalTrust;
  const sourceScope: ClaudeRuleScope = options?.sourceScope ?? 'project';

  const imports: string[] = [];
  const topLevelImportedBlocks: string[] = [];
  const skippedDuplicateAgentsMd: string[] = [];
  const blockedExternalTargets: BlockedExternalRuleTarget[] = [];
  const approvedExternalTargets: ApprovedExternalRuleTarget[] = [];

  function processText(
    content: string,
    currentFile: string,
    depth: number,
    stack: Set<string>,
  ): string {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    let inFence = false;
    let fenceChar = '';

    for (const line of lines) {
      const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
      if (fenceMatch) {
        if (!inFence) {
          inFence = true;
          fenceChar = fenceMatch[1][0];
        } else if (fenceMatch[1][0] === fenceChar) {
          inFence = false;
          fenceChar = '';
        }
        out.push(line);
        continue;
      }

      if (inFence || depth >= maxDepth) {
        out.push(line);
        continue;
      }

      const standaloneMatch =
        /^\s*(?:@import\s+|@)(~\/[^\s`]+|\.{0,2}\/[^\s`]+|[A-Za-z0-9._/-]+\.(?:md|markdown|txt))\s*$/i.exec(
          line,
        );

      if (!standaloneMatch) {
        out.push(line);
        continue;
      }

      const rawRef = standaloneMatch[1].replace(/[),.;:]+$/, '');
      const candidatePath = rawRef.startsWith('~/')
        ? expandHome(rawRef)
        : path.resolve(path.dirname(currentFile), rawRef);

      if (!fs.existsSync(candidatePath)) {
        out.push(line);
        continue;
      }

      let st: fs.Stats;
      try {
        st = fs.statSync(candidatePath);
        if (!st.isFile()) {
          out.push(line);
          continue;
        }
      } catch {
        out.push(line);
        continue;
      }

      const realTarget = safeRealpath(candidatePath);
      if (stack.has(realTarget)) {
        continue; // cycle protection
      }

      if (externalTrust) {
        const decision = evaluateExternalTargetTrust(realTarget, externalTrust);
        const curDisplay = formatDisplayPath(currentFile, workspaceRoot);
        if (!decision.allowed) {
          blockedExternalTargets.push({
            kind: 'external_import',
            sourceFile: path.resolve(currentFile),
            sourceDisplayPath: curDisplay,
            sourceScope,
            rawRef,
            resolvedTarget: realTarget,
            targetIsDir: false,
            status: decision.status,
          });
          out.push(
            `<!-- [unified-memory] skipped untrusted external @${rawRef} (${decision.status}) -->`,
          );
          continue;
        }
        if (!decision.internal) {
          approvedExternalTargets.push({
            kind: 'external_import',
            sourceDisplayPath: curDisplay,
            resolvedTarget: realTarget,
            approvedBy: decision.approvedBy,
          });
        }
      }

      const alreadyLoadedTarget =
        canonicalLoaded !== undefined &&
        (canonicalLoaded.has(realTarget) || canonicalLoaded.has(path.resolve(candidatePath)));

      if (
        deduplicateNativeAgentsMd &&
        (alreadyLoadedTarget ||
          isNativeHostRuleInWorkspace(realTarget, workspaceRoots, nativeRuleFilenames))
      ) {
        skippedDuplicateAgentsMd.push(realTarget);
        out.push(
          `<!-- [unified-memory] skipped duplicate @${rawRef} (already natively loaded by ${hostName}) -->`,
        );
        continue;
      }

      imports.push(realTarget);
      const nextStack = new Set(stack);
      nextStack.add(realTarget);
      const importedRaw = fs.readFileSync(realTarget, 'utf8');
      const expandedChild = processText(importedRaw, realTarget, depth + 1, nextStack);
      const wrapped = `\n<!-- imported from ${rawRef} -->\n${expandedChild}\n<!-- end import ${rawRef} -->\n`;
      if (depth === 0) {
        topLevelImportedBlocks.push(`#### @${rawRef}\n${expandedChild}`);
      }
      out.push(wrapped);
    }

    return out.join('\n');
  }

  const rootReal = safeRealpath(sourceFilePath);
  const initialStack = new Set<string>([rootReal]);
  const content = processText(rawContent, sourceFilePath, 0, initialStack);

  return {
    content,
    importedOnlyContent: topLevelImportedBlocks.join('\n\n'),
    imports,
    skippedDuplicateAgentsMd,
    blockedExternalTargets: dedupeBlockedTargets(blockedExternalTargets),
    approvedExternalTargets: dedupeApprovedTargets(approvedExternalTargets),
  };
}

export interface WalkRulesResult {
  files: Array<{ filePath: string; approvedExternal?: ApprovedExternalRuleTarget }>;
  blocked: BlockedExternalRuleTarget[];
  approvedDirs: ApprovedExternalRuleTarget[];
  excludedPaths: string[];
}

/**
 * Recursively discovers `.md` files under a `.claude/rules/` directory,
 * following symlinks with circular-symlink protection and optional workspace
 * external-trust enforcement BEFORE traversing symlinked external directories.
 */
export function walkRulesDirectoryWithTrust(
  rulesDir: string,
  options?: {
    workspaceRoot?: string;
    excludes?: string[];
    externalTrust?: ExternalRuleTrustContext;
    sourceScope?: ClaudeRuleScope;
  },
): WalkRulesResult {
  const files: Array<{ filePath: string; approvedExternal?: ApprovedExternalRuleTarget }> = [];
  const blocked: BlockedExternalRuleTarget[] = [];
  const approvedDirs: ApprovedExternalRuleTarget[] = [];
  const excludedPaths: string[] = [];

  if (!fs.existsSync(rulesDir)) {
    return { files, blocked, approvedDirs, excludedPaths };
  }

  const workspaceRoot = options?.workspaceRoot;
  const excludes = options?.excludes ?? [];
  const externalTrust = options?.externalTrust;
  const sourceScope: ClaudeRuleScope = options?.sourceScope ?? 'project_rule';

  if (externalTrust) {
    let rootStat: fs.Stats;
    try {
      rootStat = fs.statSync(rulesDir);
      if (!rootStat.isDirectory()) {
        return { files, blocked, approvedDirs, excludedPaths };
      }
    } catch {
      return { files, blocked, approvedDirs, excludedPaths };
    }
    const realRootDir = safeRealpath(rulesDir);
    const rootDecision = evaluateExternalTargetTrust(realRootDir, externalTrust);
    const rootDisplay = formatDisplayPath(rulesDir, workspaceRoot);
    if (!rootDecision.allowed) {
      blocked.push({
        kind: 'external_rule_dir_symlink',
        sourceFile: path.resolve(rulesDir),
        sourceDisplayPath: rootDisplay,
        sourceScope,
        resolvedTarget: realRootDir,
        targetIsDir: true,
        status: rootDecision.status,
      });
      return { files, blocked: dedupeBlockedTargets(blocked), approvedDirs, excludedPaths };
    }
    if (!rootDecision.internal) {
      approvedDirs.push({
        kind: 'external_rule_dir_symlink',
        sourceDisplayPath: rootDisplay,
        resolvedTarget: realRootDir,
        approvedBy: rootDecision.approvedBy,
      });
    }
  }

  const visitedDirs = new Set<string>();

  function visit(dir: string): void {
    const realDir = safeRealpath(dir);
    if (visitedDirs.has(realDir)) return;
    visitedDirs.add(realDir);

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (excludes.length > 0 && isExcludedPath(fullPath, workspaceRoot, excludes)) {
        excludedPaths.push(fullPath);
        continue;
      }

      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      const realTarget = safeRealpath(fullPath);
      const displayPath = formatDisplayPath(fullPath, workspaceRoot);

      if (stat.isDirectory()) {
        if (externalTrust) {
          const decision = evaluateExternalTargetTrust(realTarget, externalTrust);
          if (!decision.allowed) {
            blocked.push({
              kind: 'external_rule_dir_symlink',
              sourceFile: path.resolve(fullPath),
              sourceDisplayPath: displayPath,
              sourceScope,
              resolvedTarget: realTarget,
              targetIsDir: true,
              status: decision.status,
            });
            continue;
          }
          if (!decision.internal) {
            approvedDirs.push({
              kind: 'external_rule_dir_symlink',
              sourceDisplayPath: displayPath,
              resolvedTarget: realTarget,
              approvedBy: decision.approvedBy,
            });
          }
        }
        visit(fullPath);
      } else if (stat.isFile() && entry.name.endsWith('.md')) {
        if (externalTrust) {
          const decision = evaluateExternalTargetTrust(realTarget, externalTrust);
          if (!decision.allowed) {
            blocked.push({
              kind: 'external_rule_symlink',
              sourceFile: path.resolve(fullPath),
              sourceDisplayPath: displayPath,
              sourceScope,
              resolvedTarget: realTarget,
              targetIsDir: false,
              status: decision.status,
            });
            continue;
          }
          if (!decision.internal) {
            files.push({
              filePath: fullPath,
              approvedExternal: {
                kind: 'external_rule_symlink',
                sourceDisplayPath: displayPath,
                resolvedTarget: realTarget,
                approvedBy: decision.approvedBy,
              },
            });
            continue;
          }
        }
        files.push({ filePath: fullPath });
      }
    }
  }

  visit(rulesDir);
  return {
    files,
    blocked: dedupeBlockedTargets(blocked),
    approvedDirs: dedupeApprovedTargets(approvedDirs),
    excludedPaths,
  };
}

/**
 * Recursively discovers `.md` files under a `.claude/rules/` directory,
 * following symlinks with circular-symlink protection.
 */
export function walkRulesDirectory(rulesDir: string): string[] {
  return walkRulesDirectoryWithTrust(rulesDir).files.map((f) => f.filePath);
}

function isExcludedPath(
  filePath: string,
  workspaceRoot: string | undefined,
  excludes: string[],
): boolean {
  if (excludes.length === 0) return false;
  const candidates = [filePath.replace(/\\/g, '/')];
  if (workspaceRoot) {
    const rel = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
    if (!rel.startsWith('..')) {
      candidates.push(rel);
    }
  }
  return candidates.some((c) => matchesGlobPatterns(c, excludes));
}

export interface SingleRuleLoadResult {
  entry: ClaudeRuleEntry | null;
  blocked: BlockedExternalRuleTarget[];
  approved: ApprovedExternalRuleTarget[];
}

function loadSingleRuleFileWithDiagnostics(
  filePath: string,
  scope: ClaudeRuleScope,
  options: {
    workspaceRoot?: string;
    workspaceRoots: string[];
    deduplicateNativeAgentsMd: boolean;
    nativeRuleFilenames: readonly string[];
    hostName: string;
    canonicalAlreadyLoaded?: Set<string>;
    parsePathsFrontmatter: boolean;
    fileTrustCtx?: ExternalRuleTrustContext;
    importTrustCtx?: ExternalRuleTrustContext;
  },
): SingleRuleLoadResult {
  if (!fs.existsSync(filePath)) {
    return { entry: null, blocked: [], approved: [] };
  }
  let st: fs.Stats;
  try {
    st = fs.statSync(filePath);
    if (!st.isFile()) {
      return { entry: null, blocked: [], approved: [] };
    }
  } catch {
    return { entry: null, blocked: [], approved: [] };
  }

  const resolvedFilePath = path.resolve(filePath);
  const realFilePath = safeRealpath(filePath);
  const displayPath = formatDisplayPath(filePath, options.workspaceRoot);
  const approved: ApprovedExternalRuleTarget[] = [];

  if (!isTrustedRuleScope(scope) && options.fileTrustCtx) {
    const decision = evaluateExternalTargetTrust(realFilePath, options.fileTrustCtx);
    if (!decision.allowed) {
      return {
        entry: null,
        blocked: [
          {
            kind: 'external_rule_symlink',
            sourceFile: resolvedFilePath,
            sourceDisplayPath: displayPath,
            sourceScope: scope,
            resolvedTarget: realFilePath,
            targetIsDir: false,
            status: decision.status,
          },
        ],
        approved: [],
      };
    }
    if (!decision.internal) {
      approved.push({
        kind: 'external_rule_symlink',
        sourceDisplayPath: displayPath,
        resolvedTarget: realFilePath,
        approvedBy: decision.approvedBy,
      });
    }
  }

  const raw = fs.readFileSync(realFilePath, 'utf8');
  let body = raw;
  let pathsList: string[] | null = null;

  if (options.parsePathsFrontmatter) {
    const parsed = parseFrontmatter(raw);
    if (parsed.hasFrontmatter && !parsed.parseError) {
      body = parsed.body;
      const rawPaths = parsed.data.paths;
      if (Array.isArray(rawPaths)) {
        const clean = rawPaths
          .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
          .map((p) => p.trim());
        if (clean.length > 0) pathsList = clean;
      } else if (typeof rawPaths === 'string' && rawPaths.trim()) {
        pathsList = rawPaths
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
  }

  const expanded = expandAtImports(body, filePath, {
    workspaceRoot: options.workspaceRoot,
    workspaceRoots: options.workspaceRoots,
    deduplicateNativeAgentsMd: options.deduplicateNativeAgentsMd,
    nativeRuleFilenames: options.nativeRuleFilenames,
    hostName: options.hostName,
    alreadyLoadedPaths: options.canonicalAlreadyLoaded,
    externalTrust: isTrustedRuleScope(scope) ? undefined : options.importTrustCtx,
    sourceScope: scope,
  });

  const allBlocked = dedupeBlockedTargets(expanded.blockedExternalTargets);
  const allApproved = dedupeApprovedTargets([...approved, ...expanded.approvedExternalTargets]);

  const cleaned = stripHtmlComments(expanded.content);
  const cleanedImportedOnly = expanded.importedOnlyContent
    ? stripHtmlComments(expanded.importedOnlyContent)
    : '';
  if (!cleaned.trim() && !cleanedImportedOnly.trim()) {
    return { entry: null, blocked: allBlocked, approved: allApproved };
  }

  const dedupedByHost = Boolean(
    options.canonicalAlreadyLoaded &&
      (options.canonicalAlreadyLoaded.has(realFilePath) ||
        options.canonicalAlreadyLoaded.has(resolvedFilePath)),
  );

  return {
    entry: {
      id: realFilePath,
      filePath: resolvedFilePath,
      displayPath,
      scope,
      workspaceRoot: options.workspaceRoot,
      paths: pathsList,
      isConditional: pathsList !== null && pathsList.length > 0,
      content: cleaned,
      dedupedByHost,
      importedOnlyContent: cleanedImportedOnly,
      imports: expanded.imports,
      skippedDuplicateAgentsMd: expanded.skippedDuplicateAgentsMd,
      blockedExternalTargets: allBlocked,
      approvedExternalTargets: allApproved,
      sizeBytes: Buffer.byteLength(cleaned, 'utf8'),
      mtimeMs: st.mtimeMs,
    },
    blocked: allBlocked,
    approved: allApproved,
  };
}

export function getManagedClaudeMdPath(platform: NodeJS.Platform = process.platform): string {
  if (platform === 'darwin') {
    return '/Library/Application Support/ClaudeCode/CLAUDE.md';
  }
  if (platform === 'win32') {
    return 'C:\\ProgramData\\ClaudeCode\\CLAUDE.md';
  }
  return '/etc/claude-code/CLAUDE.md';
}

/**
 * Loads global (managed + user) and per-workspace CLAUDE.md + `.claude/rules/`
 * in exact Claude Code precedence order (broadest -> narrowest).
 * User/managed rules are trusted by default; repository-provided rules enforce
 * workspace boundary checks for external `@import`s and rule symlinks.
 */
export function loadClaudeRulesForWorkspaces(
  workspacePaths: string[],
  options?: RuleExternalTrustOptions &
    HostRuleDedupOptions & {
      platform?: NodeJS.Platform;
    },
): {
  globalAlwaysOn: ClaudeRuleEntry[];
  globalConditional: ClaudeRuleEntry[];
  workspaces: WorkspaceRulesBundle[];
} {
  const claudeConfigDir = options?.claudeConfigDir ?? getClaudeConfigDir();
  const homeDir = options?.homeDir ?? os.homedir();
  const homeReal = safeRealpath(homeDir);
  const deduplicateNativeAgentsMd = options?.deduplicateNativeAgentsMd ?? true;
  const nativeRuleFilenames = options?.nativeRuleFilenames ?? DEFAULT_NATIVE_RULE_FILENAMES;
  const hostName = options?.hostName ?? DEFAULT_HOST_NAME;
  const canonicalAlreadyLoaded = buildCanonicalPathSet(options?.alreadyLoadedPaths);

  const seenGlobalIds = new Set<string>();
  const globalAlwaysOn: ClaudeRuleEntry[] = [];
  const globalConditional: ClaudeRuleEntry[] = [];

  const userSettings = readClaudeSettings(undefined, claudeConfigDir);
  const globalExcludes = userSettings.claudeMdExcludes;

  const pushGlobal = (entry: ClaudeRuleEntry | null) => {
    if (!entry || seenGlobalIds.has(entry.id)) return;
    seenGlobalIds.add(entry.id);
    if (entry.isConditional) {
      globalConditional.push(entry);
    } else {
      globalAlwaysOn.push(entry);
    }
  };

  // 1. Managed CLAUDE.md (trusted)
  const managedPath = getManagedClaudeMdPath(options?.platform);
  if (!isExcludedPath(managedPath, undefined, globalExcludes)) {
    pushGlobal(
      loadSingleRuleFileWithDiagnostics(managedPath, 'managed', {
        workspaceRoots: workspacePaths,
        deduplicateNativeAgentsMd,
        nativeRuleFilenames,
        hostName,
        canonicalAlreadyLoaded,
        parsePathsFrontmatter: false,
      }).entry,
    );
  }

  // 2. User ~/.claude/CLAUDE.md (trusted)
  const userClaudeMd = path.join(claudeConfigDir, 'CLAUDE.md');
  if (!isExcludedPath(userClaudeMd, undefined, globalExcludes)) {
    pushGlobal(
      loadSingleRuleFileWithDiagnostics(userClaudeMd, 'user', {
        workspaceRoots: workspacePaths,
        deduplicateNativeAgentsMd,
        nativeRuleFilenames,
        hostName,
        canonicalAlreadyLoaded,
        parsePathsFrontmatter: false,
      }).entry,
    );
  }

  // 3. User ~/.claude/rules/**/*.md (trusted)
  const userRulesDir = path.join(claudeConfigDir, 'rules');
  for (const ruleFile of walkRulesDirectory(userRulesDir)) {
    if (isExcludedPath(ruleFile, undefined, globalExcludes)) continue;
    pushGlobal(
      loadSingleRuleFileWithDiagnostics(ruleFile, 'user_rule', {
        workspaceRoots: workspacePaths,
        deduplicateNativeAgentsMd,
        nativeRuleFilenames,
        hostName,
        canonicalAlreadyLoaded,
        parsePathsFrontmatter: true,
      }).entry,
    );
  }

  // 4. Per-workspace bundles (supports single-cwd & multi-root workspaces)
  const workspaces: WorkspaceRulesBundle[] = [];

  for (const rawWs of workspacePaths) {
    if (!rawWs || !fs.existsSync(rawWs)) continue;
    const wsRoot = path.resolve(rawWs);
    const wsSettings = readClaudeSettings(wsRoot, claudeConfigDir);
    const excludes = wsSettings.claudeMdExcludes;
    const seenWs = new Set<string>(seenGlobalIds);
    const alwaysOn: ClaudeRuleEntry[] = [];
    const conditional: ClaudeRuleEntry[] = [];
    const excludedPaths: string[] = [];
    const wsBlocked: BlockedExternalRuleTarget[] = [];
    const wsApproved: ApprovedExternalRuleTarget[] = [];

    const wsTrustCtx = buildWorkspaceTrustContext(wsRoot, {
      claudeConfigDir,
      homeDir,
      claudeStateFilePath: options?.claudeStateFilePath,
      trustClaudeCodeExternalApprovals: options?.trustClaudeCodeExternalApprovals,
      externalRuleTrust: options?.externalRuleTrust,
    });
    const gitTopLevel = resolveGitTopLevel(wsRoot);

    const addWsEntry = (
      filePath: string,
      scope: ClaudeRuleScope,
      parsePathsFrontmatter: boolean,
      trustOverride?: {
        fileTrustCtx: ExternalRuleTrustContext;
        importTrustCtx: ExternalRuleTrustContext;
      },
    ) => {
      if (!fs.existsSync(filePath)) return;
      if (isExcludedPath(filePath, wsRoot, excludes)) {
        excludedPaths.push(filePath);
        return;
      }
      const res = loadSingleRuleFileWithDiagnostics(filePath, scope, {
        workspaceRoot: wsRoot,
        workspaceRoots: [wsRoot],
        deduplicateNativeAgentsMd,
        nativeRuleFilenames,
        hostName,
        canonicalAlreadyLoaded,
        parsePathsFrontmatter,
        fileTrustCtx: trustOverride?.fileTrustCtx ?? wsTrustCtx,
        importTrustCtx: trustOverride?.importTrustCtx ?? wsTrustCtx,
      });
      if (res.blocked.length > 0) wsBlocked.push(...res.blocked);
      if (res.approved.length > 0) wsApproved.push(...res.approved);

      const entry = res.entry;
      if (!entry || seenWs.has(entry.id)) return;
      seenWs.add(entry.id);
      if (entry.isConditional) {
        conditional.push(entry);
      } else {
        alwaysOn.push(entry);
      }
    };

    // Walk ancestors above wsRoot (from filesystem root down to parent of wsRoot)
    const ancestors: string[] = [];
    let cur = path.dirname(wsRoot);
    while (cur && cur !== path.dirname(cur)) {
      ancestors.unshift(cur);
      cur = path.dirname(cur);
    }
    for (const anc of ancestors) {
      const ancReal = safeRealpath(anc);
      const inSameGitRepo =
        gitTopLevel !== null &&
        gitTopLevel !== path.parse(gitTopLevel).root &&
        gitTopLevel !== homeReal &&
        isPathWithinRoot(ancReal, gitTopLevel);

      const ancImportTrust: ExternalRuleTrustContext = inSameGitRepo
        ? {
            ...wsTrustCtx,
            allowedRoots: Array.from(new Set([wsTrustCtx.workspaceRealRoot, gitTopLevel])),
          }
        : wsTrustCtx;
      const ancFileTrust: ExternalRuleTrustContext = {
        ...ancImportTrust,
        allowedRoots: Array.from(new Set([...ancImportTrust.allowedRoots, ancReal])),
      };
      const ancOverride = { fileTrustCtx: ancFileTrust, importTrustCtx: ancImportTrust };

      if (anc === homeDir || ancReal === homeReal) {
        addWsEntry(path.join(anc, 'CLAUDE.md'), 'ancestor', false, ancOverride);
        continue;
      }
      addWsEntry(path.join(anc, 'CLAUDE.md'), 'ancestor', false, ancOverride);
      addWsEntry(path.join(anc, '.claude', 'CLAUDE.md'), 'ancestor', false, ancOverride);
    }

    // Project root CLAUDE.md -> .claude/CLAUDE.md -> .claude/rules/**/*.md -> CLAUDE.local.md
    addWsEntry(path.join(wsRoot, 'CLAUDE.md'), 'project', false);
    addWsEntry(path.join(wsRoot, '.claude', 'CLAUDE.md'), 'project', false);

    const projRulesDir = path.join(wsRoot, '.claude', 'rules');
    const walked = walkRulesDirectoryWithTrust(projRulesDir, {
      workspaceRoot: wsRoot,
      excludes,
      externalTrust: wsTrustCtx,
      sourceScope: 'project_rule',
    });
    if (walked.excludedPaths.length > 0) excludedPaths.push(...walked.excludedPaths);
    if (walked.blocked.length > 0) wsBlocked.push(...walked.blocked);
    if (walked.approvedDirs.length > 0) wsApproved.push(...walked.approvedDirs);
    for (const item of walked.files) {
      addWsEntry(item.filePath, 'project_rule', true);
    }

    addWsEntry(path.join(wsRoot, 'CLAUDE.local.md'), 'local', false);

    workspaces.push({
      workspaceRoot: wsRoot,
      alwaysOn,
      conditional,
      excludedPaths,
      blockedExternalTargets: dedupeBlockedTargets(wsBlocked),
      approvedExternalTargets: dedupeApprovedTargets(wsApproved),
      claudeCodeExternalApproval: wsTrustCtx.claudeCodeApproval,
    });
  }

  return { globalAlwaysOn, globalConditional, workspaces };
}

export interface SubdirRulesDiscoveryResult {
  entries: ClaudeRuleEntry[];
  blocked: BlockedExternalRuleTarget[];
  approved: ApprovedExternalRuleTarget[];
}

/**
 * Discovers lazy-loaded subdirectory CLAUDE.md files between an accessed file's
 * parent directory and its containing workspaceRoot (exclusive of workspaceRoot itself),
 * returning both loaded entries and any blocked/approved external target diagnostics.
 */
export function findSubdirectoryClaudeMdsWithDiagnostics(
  accessedFilePath: string,
  workspaceRoot: string,
  options?: RuleExternalTrustOptions & HostRuleDedupOptions,
): SubdirRulesDiscoveryResult {
  const absFile = path.resolve(accessedFilePath);
  const absWs = path.resolve(workspaceRoot);
  if (absFile !== absWs && !absFile.startsWith(absWs + path.sep)) {
    return { entries: [], blocked: [], approved: [] };
  }

  const claudeConfigDir = options?.claudeConfigDir ?? getClaudeConfigDir();
  const wsSettings = readClaudeSettings(absWs, claudeConfigDir);
  const excludes = wsSettings.claudeMdExcludes;
  const wsTrustCtx = buildWorkspaceTrustContext(absWs, options);
  const canonicalAlreadyLoaded = buildCanonicalPathSet(options?.alreadyLoadedPaths);

  const dirs: string[] = [];
  let cur = path.dirname(absFile);
  while (cur.length > absWs.length && cur.startsWith(absWs + path.sep)) {
    dirs.unshift(cur);
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  const entries: ClaudeRuleEntry[] = [];
  const blocked: BlockedExternalRuleTarget[] = [];
  const approved: ApprovedExternalRuleTarget[] = [];
  const seen = new Set<string>();
  for (const dir of dirs) {
    for (const candidate of [
      path.join(dir, 'CLAUDE.md'),
      path.join(dir, '.claude', 'CLAUDE.md'),
      path.join(dir, 'CLAUDE.local.md'),
    ]) {
      if (!fs.existsSync(candidate)) continue;
      if (isExcludedPath(candidate, absWs, excludes)) continue;
      const res = loadSingleRuleFileWithDiagnostics(candidate, 'subdir', {
        workspaceRoot: absWs,
        workspaceRoots: [absWs],
        deduplicateNativeAgentsMd: options?.deduplicateNativeAgentsMd ?? true,
        nativeRuleFilenames: options?.nativeRuleFilenames ?? DEFAULT_NATIVE_RULE_FILENAMES,
        hostName: options?.hostName ?? DEFAULT_HOST_NAME,
        canonicalAlreadyLoaded,
        parsePathsFrontmatter: false,
        fileTrustCtx: wsTrustCtx,
        importTrustCtx: wsTrustCtx,
      });
      if (res.blocked.length > 0) blocked.push(...res.blocked);
      if (res.approved.length > 0) approved.push(...res.approved);
      if (res.entry && !seen.has(res.entry.id)) {
        seen.add(res.entry.id);
        entries.push(res.entry);
      }
    }
  }

  return {
    entries,
    blocked: dedupeBlockedTargets(blocked),
    approved: dedupeApprovedTargets(approved),
  };
}

/**
 * Discovers lazy-loaded subdirectory CLAUDE.md files between an accessed file's
 * parent directory and its containing workspaceRoot (exclusive of workspaceRoot itself).
 */
export function findSubdirectoryClaudeMds(
  accessedFilePath: string,
  workspaceRoot: string,
  options?: RuleExternalTrustOptions & HostRuleDedupOptions,
): ClaudeRuleEntry[] {
  return findSubdirectoryClaudeMdsWithDiagnostics(accessedFilePath, workspaceRoot, options).entries;
}

export function loadConditionalRuleContentWithDiagnostics(
  ruleFilePath: string,
  workspaceRoot: string,
  scope: ClaudeRuleScope,
  options?: RuleExternalTrustOptions & HostRuleDedupOptions,
): SingleRuleLoadResult {
  const trusted = isTrustedRuleScope(scope);
  const wsTrustCtx = trusted ? undefined : buildWorkspaceTrustContext(workspaceRoot, options);
  const parsePathsFrontmatter = scope === 'project_rule' || scope === 'user_rule';
  const canonicalAlreadyLoaded = buildCanonicalPathSet(options?.alreadyLoadedPaths);
  return loadSingleRuleFileWithDiagnostics(ruleFilePath, scope, {
    workspaceRoot: trusted ? undefined : workspaceRoot,
    workspaceRoots: [workspaceRoot],
    deduplicateNativeAgentsMd: options?.deduplicateNativeAgentsMd ?? true,
    nativeRuleFilenames: options?.nativeRuleFilenames ?? DEFAULT_NATIVE_RULE_FILENAMES,
    hostName: options?.hostName ?? DEFAULT_HOST_NAME,
    canonicalAlreadyLoaded,
    parsePathsFrontmatter,
    fileTrustCtx: wsTrustCtx,
    importTrustCtx: wsTrustCtx,
  });
}

export function loadConditionalRuleContent(
  ruleFilePath: string,
  workspaceRoot: string,
  scope: ClaudeRuleScope,
  options?: RuleExternalTrustOptions & HostRuleDedupOptions,
): ClaudeRuleEntry | null {
  return loadConditionalRuleContentWithDiagnostics(ruleFilePath, workspaceRoot, scope, options)
    .entry;
}
