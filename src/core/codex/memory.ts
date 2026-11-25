import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  CodexGenerationStats,
  CodexMemoryStatus,
  CodexSearchHit,
} from '../types.js';
import { expandHome } from '../claude/paths.js';

/**
 * STRICTLY READ-ONLY OpenAI Codex CLI memory adapter.
 *
 * Codex's `~/.codex/memories_v2/` and `~/.codex/memories/` are generated state
 * managed by `codex-rs/memories` (SQLite + internal `.git` baseline).
 * This module intentionally imports/performs ZERO filesystem write operations.
 */

export function getCodexHome(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.CODEX_HOME?.trim();
  if (configured) return expandHome(configured);
  return path.join(os.homedir(), '.codex');
}

function readCodexConfigFlags(codexHome: string): CodexMemoryStatus['configFlags'] {
  const configPath = path.join(codexHome, 'config.toml');
  if (!fs.existsSync(configPath)) return {};

  try {
    const raw = fs.readFileSync(configPath, 'utf8').replace(/\r\n/g, '\n');
    let section = '';
    const flags: CodexMemoryStatus['configFlags'] = {};

    for (const rawLine of raw.split('\n')) {
      const line = rawLine.replace(/#.*$/, '').trim();
      if (!line) continue;
      const secMatch = /^\[([^\]]+)\]$/.exec(line);
      if (secMatch) {
        section = secMatch[1].trim();
        continue;
      }
      const kv = /^([A-Za-z0-9_-]+)\s*=\s*(true|false)$/i.exec(line);
      if (!kv) continue;
      const key = kv[1];
      const val = kv[2].toLowerCase() === 'true';

      if (section === 'features' && key === 'memories') {
        flags.featuresMemories = val;
      } else if (section === 'memories' && key === 'generate_memories') {
        flags.generateMemories = val;
      } else if (section === 'memories' && key === 'use_memories') {
        flags.useMemories = val;
      }
    }
    return flags;
  } catch {
    return {};
  }
}

const DISALLOWED_CODEX_EXT_RE = /\.(?:sqlite|sqlite3|sqlite-wal|sqlite-shm|db|db-wal|db-shm|lock)$/i;

/**
 * Checks whether a normalized forward-slash relative path inside a Codex memory
 * generation root is disallowed (traversal, nested `.git`, `.codex-baseline`,
 * `raw_memories.md`, SQLite/DB/WAL/SHM/lock files).
 */
function isDisallowedCodexRelativePath(cleanRel: string): boolean {
  if (!cleanRel) return true;
  const segments = cleanRel.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return true;
  for (const seg of segments) {
    if (seg === '.' || seg === '..') return true;
    if (seg === '.git' || seg === '.codex-baseline') return true;
  }
  const base = segments[segments.length - 1];
  if (base === 'raw_memories.md') return true;
  if (DISALLOWED_CODEX_EXT_RE.test(base)) return true;
  return false;
}

/**
 * Verifies via `fs.realpathSync` that `targetPath` exists as a regular file and
 * remains strictly inside `rootDir` after resolving all symlinks, and that its
 * canonical relative path inside `rootDir` is also allowed.
 */
function resolveSafeCodexFile(rootDir: string, targetPath: string): string | null {
  try {
    const realRoot = fs.realpathSync(rootDir);
    const realTarget = fs.realpathSync(targetPath);
    if (!realTarget.startsWith(realRoot + path.sep)) {
      return null;
    }
    const realRel = path.relative(realRoot, realTarget).replace(/\\/g, '/');
    if (isDisallowedCodexRelativePath(realRel)) {
      return null;
    }
    if (!fs.statSync(realTarget).isFile()) {
      return null;
    }
    return realTarget;
  } catch {
    return null;
  }
}

function collectExtensionFiles(dirPath: string): string[] {
  const extDir = path.join(dirPath, 'extensions');
  if (!fs.existsSync(extDir)) return [];
  let realRoot: string;
  try {
    realRoot = fs.realpathSync(dirPath);
    const realExt = fs.realpathSync(extDir);
    if (!realExt.startsWith(realRoot + path.sep)) return [];
  } catch {
    return [];
  }

  const files: string[] = [];
  const visitedDirs = new Set<string>();

  function walk(cur: string, relBase: string): void {
    let realCur: string;
    try {
      realCur = fs.realpathSync(cur);
    } catch {
      return;
    }
    if (!realCur.startsWith(realRoot + path.sep) || visitedDirs.has(realCur)) return;
    visitedDirs.add(realCur);

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const full = path.join(cur, e.name);
      const rel = relBase ? `${relBase}/${e.name}` : e.name;
      if (e.isDirectory()) {
        walk(full, rel);
      } else if (e.isFile() && (e.name.endsWith('.md') || e.name.endsWith('.txt'))) {
        if (resolveSafeCodexFile(dirPath, full)) {
          files.push(`extensions/${rel}`);
        }
      }
    }
  }

  walk(extDir, '');
  files.sort();
  return files;
}

function inspectGeneration(
  codexHome: string,
  generation: 'v2' | 'v1',
): CodexGenerationStats {
  const dirName = generation === 'v2' ? 'memories_v2' : 'memories';
  const dirPath = path.join(codexHome, dirName);
  const exists = fs.existsSync(dirPath);

  if (!exists) {
    return {
      generation,
      dirPath,
      exists: false,
      hasSummary: false,
      summaryBytes: 0,
      summaryLines: 0,
      summaryMtimeMs: 0,
      hasHandbook: false,
      handbookBytes: 0,
      rolloutCount: 0,
      extensionFiles: [],
      skillNames: [],
    };
  }

  const summaryPath = path.join(dirPath, 'memory_summary.md');
  let hasSummary = false;
  let summaryBytes = 0;
  let summaryLines = 0;
  let summaryMtimeMs = 0;
  const safeSummaryPath = resolveSafeCodexFile(dirPath, summaryPath);
  if (safeSummaryPath) {
    try {
      const st = fs.statSync(safeSummaryPath);
      hasSummary = true;
      summaryBytes = st.size;
      summaryMtimeMs = st.mtimeMs;
      const text = fs.readFileSync(safeSummaryPath, 'utf8');
      summaryLines = text === '' ? 0 : text.replace(/\r\n/g, '\n').split('\n').length;
    } catch {
      // ignore
    }
  }

  const handbookPath = path.join(dirPath, 'MEMORY.md');
  let hasHandbook = false;
  let handbookBytes = 0;
  const safeHandbookPath = resolveSafeCodexFile(dirPath, handbookPath);
  if (safeHandbookPath) {
    try {
      hasHandbook = true;
      handbookBytes = fs.statSync(safeHandbookPath).size;
    } catch {
      // ignore
    }
  }

  let rolloutCount = 0;
  const rolloutsDir = path.join(dirPath, 'rollout_summaries');
  if (fs.existsSync(rolloutsDir)) {
    try {
      rolloutCount = fs
        .readdirSync(rolloutsDir, { withFileTypes: true })
        .filter(
          (e) =>
            e.isFile() &&
            e.name.endsWith('.md') &&
            resolveSafeCodexFile(dirPath, path.join(rolloutsDir, e.name)) !== null,
        ).length;
    } catch {
      // ignore
    }
  }

  const extensionFiles = collectExtensionFiles(dirPath);

  const skillNames: string[] = [];
  const skillsDir = path.join(dirPath, 'skills');
  if (fs.existsSync(skillsDir)) {
    try {
      for (const e of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        if (
          e.isDirectory() &&
          resolveSafeCodexFile(dirPath, path.join(skillsDir, e.name, 'SKILL.md')) !== null
        ) {
          skillNames.push(e.name);
        }
      }
      skillNames.sort();
    } catch {
      // ignore
    }
  }

  return {
    generation,
    dirPath,
    exists: true,
    hasSummary,
    summaryBytes,
    summaryLines,
    summaryMtimeMs,
    hasHandbook,
    handbookBytes,
    rolloutCount,
    extensionFiles,
    skillNames,
  };
}

export function getCodexMemoryStatus(
  codexHome: string = getCodexHome(),
): CodexMemoryStatus {
  const exists = fs.existsSync(codexHome);
  const v2 = inspectGeneration(codexHome, 'v2');
  const v1 = inspectGeneration(codexHome, 'v1');

  let activeGeneration: 'v2' | 'v1' | 'none' = 'none';
  if (v2.exists && v2.hasSummary) {
    activeGeneration =
      !v1.hasSummary || v2.summaryMtimeMs >= v1.summaryMtimeMs ? 'v2' : 'v1';
  } else if (v1.exists && (v1.hasSummary || v1.hasHandbook)) {
    activeGeneration = 'v1';
  } else if (v2.exists) {
    activeGeneration = 'v2';
  } else if (v1.exists) {
    activeGeneration = 'v1';
  }

  return {
    codexHome,
    exists,
    configFlags: readCodexConfigFlags(codexHome),
    activeGeneration,
    v2,
    v1,
    hasGlobalAgentsMd: fs.existsSync(path.join(codexHome, 'AGENTS.md')),
    hasGlobalAgentsOverrideMd: fs.existsSync(path.join(codexHome, 'AGENTS.override.md')),
  };
}

/**
 * Strips the leading bare `v1` version header line from Codex `memory_summary.md`.
 */
export function stripCodexVersionHeader(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length > 0 && /^v\d+$/i.test(lines[0].trim())) {
    let start = 1;
    while (start < lines.length && lines[start].trim() === '') {
      start++;
    }
    return lines.slice(start).join('\n');
  }
  return normalized;
}

function truncateByBytesOnLineBoundary(text: string, maxBytes: number): {
  content: string;
  truncated: boolean;
  totalBytes: number;
} {
  const totalBytes = Buffer.byteLength(text, 'utf8');
  if (totalBytes <= maxBytes) {
    return { content: text, truncated: false, totalBytes };
  }
  const lines = text.split('\n');
  const kept: string[] = [];
  let used = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineBytes = Buffer.byteLength(lines[i], 'utf8') + (i > 0 ? 1 : 0);
    if (used + lineBytes > maxBytes) break;
    kept.push(lines[i]);
    used += lineBytes;
  }
  return { content: kept.join('\n'), truncated: true, totalBytes };
}

export function readCodexSummary(options?: {
  codexHome?: string;
  generation?: 'auto' | 'v2' | 'v1';
  maxBytes?: number;
}): {
  generation: 'v2' | 'v1' | 'none';
  filePath?: string;
  content: string;
  truncated: boolean;
  totalBytes: number;
  mtimeMs: number;
} {
  const codexHome = options?.codexHome ?? getCodexHome();
  const status = getCodexMemoryStatus(codexHome);
  const chosen =
    options?.generation && options.generation !== 'auto'
      ? options.generation
      : status.activeGeneration;

  if (chosen === 'none') {
    return { generation: 'none', content: '', truncated: false, totalBytes: 0, mtimeMs: 0 };
  }

  const genStats = chosen === 'v2' ? status.v2 : status.v1;
  const summaryPath = path.join(genStats.dirPath, 'memory_summary.md');
  const safeSummaryPath = resolveSafeCodexFile(genStats.dirPath, summaryPath);
  if (!safeSummaryPath) {
    return { generation: chosen, content: '', truncated: false, totalBytes: 0, mtimeMs: 0 };
  }

  const st = fs.statSync(safeSummaryPath);
  const raw = fs.readFileSync(safeSummaryPath, 'utf8');
  const cleaned = stripCodexVersionHeader(raw);
  const maxBytes = options?.maxBytes ?? 8 * 1024;
  const trunc = truncateByBytesOnLineBoundary(cleaned, maxBytes);

  return {
    generation: chosen,
    filePath: summaryPath,
    content: trunc.content,
    truncated: trunc.truncated,
    totalBytes: trunc.totalBytes,
    mtimeMs: st.mtimeMs,
  };
}

export function readCodexGlobalAgentsMd(codexHome: string = getCodexHome()): {
  filePath: string;
  isOverride: boolean;
  content: string;
} | null {
  const overridePath = path.join(codexHome, 'AGENTS.override.md');
  if (fs.existsSync(overridePath)) {
    return {
      filePath: overridePath,
      isOverride: true,
      content: fs.readFileSync(overridePath, 'utf8').trim(),
    };
  }
  const agentsPath = path.join(codexHome, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    return {
      filePath: agentsPath,
      isOverride: false,
      content: fs.readFileSync(agentsPath, 'utf8').trim(),
    };
  }
  return null;
}

/**
 * Strictly path-jailed read-only file reader for Codex memory files.
 * Blocks `..`, `.git`, `.codex-baseline`, `raw_memories.md`, and `*.sqlite`.
 */
export function readCodexMemoryFile(
  generation: 'v2' | 'v1',
  relativePath: string,
  codexHome: string = getCodexHome(),
  maxBytes: number = 64 * 1024,
): {
  generation: 'v2' | 'v1';
  relativePath: string;
  filePath: string;
  content: string;
  truncated: boolean;
  totalBytes: number;
  mtimeMs: number;
} {
  const dirName = generation === 'v2' ? 'memories_v2' : 'memories';
  const rootDir = path.resolve(codexHome, dirName);
  const cleanRel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');

  if (isDisallowedCodexRelativePath(cleanRel)) {
    throw new Error(`Disallowed Codex memory path: ${relativePath}`);
  }

  const target = path.resolve(rootDir, cleanRel);
  if (!target.startsWith(rootDir + path.sep)) {
    throw new Error(`Path escapes Codex memory root: ${relativePath}`);
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new Error(`Codex memory file not found: ${generation}/${cleanRel}`);
  }

  const realRoot = fs.realpathSync(rootDir);
  const realTarget = fs.realpathSync(target);
  if (!realTarget.startsWith(realRoot + path.sep)) {
    throw new Error(`Path escapes Codex memory root via symlink: ${relativePath}`);
  }
  const realRel = path.relative(realRoot, realTarget).replace(/\\/g, '/');
  if (isDisallowedCodexRelativePath(realRel)) {
    throw new Error(`Disallowed Codex memory symlink target: ${relativePath}`);
  }

  const st = fs.statSync(realTarget);
  const raw = fs.readFileSync(realTarget, 'utf8');
  const text = cleanRel === 'memory_summary.md' ? stripCodexVersionHeader(raw) : raw;
  const trunc = truncateByBytesOnLineBoundary(text, maxBytes);

  return {
    generation,
    relativePath: cleanRel,
    filePath: target,
    content: trunc.content,
    truncated: trunc.truncated,
    totalBytes: trunc.totalBytes,
    mtimeMs: st.mtimeMs,
  };
}

export function listCodexFiles(
  generation: 'v2' | 'v1',
  codexHome: string = getCodexHome(),
): Array<{
  category: CodexSearchHit['category'];
  relativePath: string;
  title: string;
  sizeBytes: number;
  mtimeMs: number;
}> {
  const stats = inspectGeneration(codexHome, generation);
  if (!stats.exists) return [];
  const items: Array<{
    category: CodexSearchHit['category'];
    relativePath: string;
    title: string;
    sizeBytes: number;
    mtimeMs: number;
  }> = [];

  if (stats.hasSummary) {
    items.push({
      category: 'summary',
      relativePath: 'memory_summary.md',
      title: 'memory_summary.md',
      sizeBytes: stats.summaryBytes,
      mtimeMs: stats.summaryMtimeMs,
    });
  }

  if (stats.hasHandbook) {
    const hbPath = path.join(stats.dirPath, 'MEMORY.md');
    items.push({
      category: 'handbook',
      relativePath: 'MEMORY.md',
      title: 'MEMORY.md (Handbook)',
      sizeBytes: stats.handbookBytes,
      mtimeMs: fs.statSync(hbPath).mtimeMs,
    });
  }

  for (const extRel of stats.extensionFiles) {
    const full = path.join(stats.dirPath, extRel);
    try {
      const st = fs.statSync(full);
      items.push({
        category: 'extension',
        relativePath: extRel,
        title: extRel,
        sizeBytes: st.size,
        mtimeMs: st.mtimeMs,
      });
    } catch {
      // ignore
    }
  }

  for (const skill of stats.skillNames) {
    const rel = `skills/${skill}/SKILL.md`;
    const full = path.join(stats.dirPath, rel);
    try {
      const st = fs.statSync(full);
      items.push({
        category: 'skill',
        relativePath: rel,
        title: `skill: ${skill}`,
        sizeBytes: st.size,
        mtimeMs: st.mtimeMs,
      });
    } catch {
      // ignore
    }
  }

  const rolloutsDir = path.join(stats.dirPath, 'rollout_summaries');
  if (fs.existsSync(rolloutsDir)) {
    try {
      for (const e of fs.readdirSync(rolloutsDir, { withFileTypes: true })) {
        if (!e.isFile() || !e.name.endsWith('.md')) continue;
        const rel = `rollout_summaries/${e.name}`;
        const safePath = resolveSafeCodexFile(stats.dirPath, path.join(rolloutsDir, e.name));
        if (!safePath) continue;
        const st = fs.statSync(safePath);
        items.push({
          category: 'rollout',
          relativePath: rel,
          title: e.name.replace(/\.md$/, ''),
          sizeBytes: st.size,
          mtimeMs: st.mtimeMs,
        });
      }
    } catch {
      // ignore
    }
  }

  items.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return items;
}

const QUERY_SPLIT_RE = /[\s,;:()[\]{}"'`/\\，。；：、（）【】《》“”‘’？！·—…]+/;
const HAN_RUN_RE = /\p{Script=Han}+/gu;

/**
 * Bilingual (Latin + CJK) query tokenizer.
 * Splits on both ASCII and Chinese full-width punctuation, keeps exact phrases/words,
 * and generates overlapping 2-gram fallback tokens for CJK runs >= 3 chars so Chinese
 * queries match even without spaces.
 */
export function tokenizeQuery(q: string): { exact: string[]; bigrams: string[] } {
  const exactSet = new Set<string>();
  const bigramSet = new Set<string>();

  const parts = q
    .toLowerCase()
    .split(QUERY_SPLIT_RE)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const part of parts) {
    const hasHan = /\p{Script=Han}/u.test(part);
    if (part.length >= 2 || (hasHan && parts.length === 1)) {
      exactSet.add(part);
    }

    if (hasHan) {
      for (const match of part.matchAll(HAN_RUN_RE)) {
        const run = match[0];
        if (run.length >= 2) {
          exactSet.add(run);
        }
        if (run.length >= 3) {
          for (let i = 0; i < run.length - 1 && bigramSet.size < 24; i++) {
            const bg = run.slice(i, i + 2);
            if (!exactSet.has(bg)) {
              bigramSet.add(bg);
            }
          }
        }
      }
      // Also extract embedded Latin/digit words inside mixed CJK queries like "SQLite数据库"
      for (const latin of part.match(/[a-z0-9._-]{2,}/g) ?? []) {
        exactSet.add(latin);
      }
    }
  }

  return {
    exact: Array.from(exactSet),
    bigrams: Array.from(bigramSet),
  };
}

function scoreAndExtractSnippet(
  text: string,
  title: string,
  terms: { exact: string[]; bigrams: string[] },
  projectTerms: { exact: string[]; bigrams: string[] },
): { score: number; snippet: string } {
  const lowerText = text.toLowerCase();
  const lowerTitle = title.toLowerCase();
  let score = 0;
  let bestPos = -1;

  for (const term of terms.exact) {
    if (lowerTitle.includes(term)) score += 6;
    let idx = lowerText.indexOf(term);
    let count = 0;
    while (idx !== -1 && count < 8) {
      if (bestPos === -1) bestPos = idx;
      score += 2;
      count++;
      idx = lowerText.indexOf(term, idx + term.length);
    }
  }

  // Fallback CJK bigrams add lower weight so exact phrase matches always rank first
  for (const bg of terms.bigrams) {
    if (lowerTitle.includes(bg)) score += 2;
    let idx = lowerText.indexOf(bg);
    let count = 0;
    while (idx !== -1 && count < 4) {
      if (bestPos === -1) bestPos = idx;
      score += 1;
      count++;
      idx = lowerText.indexOf(bg, idx + bg.length);
    }
  }

  if (score === 0 && (terms.exact.length > 0 || terms.bigrams.length > 0)) {
    return { score: 0, snippet: '' };
  }

  for (const pt of projectTerms.exact) {
    if (lowerTitle.includes(pt)) score += 5;
    if (lowerText.includes(pt)) score += 3;
  }

  const pos = bestPos === -1 ? 0 : Math.max(0, bestPos - 140);
  const rawSnippet = text.slice(pos, pos + 420).replace(/\s+/g, ' ').trim();
  const snippet = (pos > 0 ? '...' : '') + rawSnippet + (pos + 420 < text.length ? '...' : '');
  return { score: Math.max(score, 1), snippet };
}

/**
 * Read-only keyword + project-weighted search across Codex memories (v2 first,
 * with optional v1 fallback including chunked handbook sections).
 */
export function searchCodexMemories(
  query: string,
  options?: {
    codexHome?: string;
    projectHint?: string;
    generation?: 'auto' | 'v2' | 'v1' | 'both';
    limit?: number;
  },
): CodexSearchHit[] {
  const codexHome = options?.codexHome ?? getCodexHome();
  const status = getCodexMemoryStatus(codexHome);
  const limit = Math.min(Math.max(options?.limit ?? 12, 1), 50);
  const terms = tokenizeQuery(query);
  const projectTerms = options?.projectHint
    ? tokenizeQuery(options.projectHint)
    : { exact: [], bigrams: [] };

  const gens: Array<'v2' | 'v1'> = [];
  const mode = options?.generation ?? 'auto';
  if (mode === 'both') {
    if (status.v2.exists) gens.push('v2');
    if (status.v1.exists) gens.push('v1');
  } else if (mode === 'v2') {
    if (status.v2.exists) gens.push('v2');
  } else if (mode === 'v1') {
    if (status.v1.exists) gens.push('v1');
  } else {
    if (status.activeGeneration !== 'none') gens.push(status.activeGeneration);
    if (status.activeGeneration === 'v2' && status.v1.exists) {
      gens.push('v1');
    }
  }

  const hits: CodexSearchHit[] = [];
  const seenRelPaths = new Set<string>();

  for (const gen of gens) {
    const genDir = gen === 'v2' ? status.v2.dirPath : status.v1.dirPath;
    const files = listCodexFiles(gen, codexHome);

    for (const file of files) {
      if (file.category === 'rollout' && seenRelPaths.has(file.relativePath)) continue;
      seenRelPaths.add(file.relativePath);

      const fullPath = resolveSafeCodexFile(genDir, path.join(genDir, file.relativePath));
      if (!fullPath) continue;
      let text: string;
      try {
        text = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }

      if (file.category === 'handbook') {
        const sections = text.split(/(?=^#{1,3}\s+)/m);
        for (const sec of sections) {
          const headingMatch = /^(#{1,3}\s+.+)$/m.exec(sec);
          const secTitle = headingMatch
            ? `MEMORY.md :: ${headingMatch[1].replace(/^#+\s*/, '').trim()}`
            : 'MEMORY.md';
          const scored = scoreAndExtractSnippet(sec, secTitle, terms, projectTerms);
          if (scored.score > 0) {
            hits.push({
              generation: gen,
              category: 'handbook',
              relativePath: file.relativePath,
              title: secTitle,
              score: scored.score + (gen === 'v2' ? 2 : 0),
              snippet: scored.snippet,
              mtimeMs: file.mtimeMs,
              sizeBytes: Buffer.byteLength(sec, 'utf8'),
            });
          }
        }
        continue;
      }

      const scored = scoreAndExtractSnippet(text, file.title, terms, projectTerms);
      if (scored.score > 0) {
        hits.push({
          generation: gen,
          category: file.category,
          relativePath: file.relativePath,
          title: file.title,
          score: scored.score + (gen === 'v2' ? 3 : 0),
          snippet: scored.snippet,
          mtimeMs: file.mtimeMs,
          sizeBytes: file.sizeBytes,
        });
      }
    }
  }

  hits.sort((a, b) => b.score - a.score || b.mtimeMs - a.mtimeMs);
  return hits.slice(0, limit);
}
