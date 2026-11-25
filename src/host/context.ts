import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { Context } from '@deepseek-ai/cordis';
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import type { Session, UserMessage } from '@deepseek-ai/dsh-session';
import type {
  ToolExecution,
  ToolExecutionResult,
  ToolExecutionToken,
} from '@deepseek-ai/dsh-tools';
import {
  DEFAULT_HOST_NAME,
  DEFAULT_NATIVE_RULE_FILENAMES,
  appendDiagnosticEvent,
  createEmptySessionState,
  findSubdirectoryClaudeMdsWithDiagnostics,
  gcStaleSessions,
  getMessages,
  loadClaudeRulesForWorkspaces,
  loadConditionalRuleContentWithDiagnostics,
  loadSessionState,
  matchesGlobPatterns,
  readCodexGlobalAgentsMd,
  readCodexSummary,
  readMemoryIndex,
  resolveClaudeProject,
  resolveGitTopLevel,
  saveSessionState,
  listTopicMemories,
  type ClaudeRuleEntry,
  type IndexedConditionalRule,
  type ResolvedLocale,
  type SessionState,
  type UnifiedMemoryConfig,
} from '../core/index.js';
import type {
  LiveSessionConditionalRuleItem,
  LiveSessionContextSnapshot,
  LiveSessionRuleItem,
  LiveSessionSubdirRuleItem,
} from '../shared/api-contract.js';
import type { HostRuntime } from './runtime.js';

export const UNIFIED_MEMORY_SOURCE_KIND = 'unified-memory';

interface UnifiedMemoryMessageSource {
  kind: typeof UNIFIED_MEMORY_SOURCE_KIND;
  form: 'instructions' | 'recall' | 'notice';
  baseline?: boolean;
  lazy?: boolean;
  cwd?: string;
  locale?: ResolvedLocale;
  replaceGeneration?: number;
  summary?: string;
}

interface HostAgentInstructionChange {
  action?: string;
  scope?: string;
  path?: string;
}

interface HostAgentInstructionsSource {
  kind: 'agent-instructions';
  baselineIdentity?: string;
  changes?: HostAgentInstructionChange[];
}

interface FileTouch {
  agent: Agent;
  filePath: string;
  toolName: string;
}

/**
 * Escapes literal `</system-reminder>` tags inside user/workspace content so
 * untrusted markdown cannot close the outer `<system-reminder>` wrapper.
 */
export function escapeSystemReminder(text: string): string {
  return text.replace(/<\/system-reminder>/gi, '<\\/system-reminder>');
}

export function wrapSystemReminder(text: string): string {
  return `<system-reminder>\n${escapeSystemReminder(text)}\n</system-reminder>`;
}

function clampUtf8(text: string, maxBytes: number): { content: string; truncated: boolean } {
  const total = Buffer.byteLength(text, 'utf8');
  if (total <= maxBytes) return { content: text, truncated: false };
  const lines = text.split('\n');
  const out: string[] = [];
  let used = 0;
  for (let i = 0; i < lines.length; i++) {
    const b = Buffer.byteLength(lines[i], 'utf8') + (i > 0 ? 1 : 0);
    if (used + b > maxBytes) break;
    out.push(lines[i]);
    used += b;
  }
  return { content: out.join('\n'), truncated: true };
}

function resolveChangePath(
  rawPath: string,
  baseDir: string | null,
  homeDir: string,
): string | null {
  const trimmed = rawPath.trim();
  if (!trimmed) return null;
  if (trimmed === '~') {
    return path.resolve(homeDir);
  }
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return path.resolve(path.join(homeDir, trimmed.slice(2)));
  }
  if (path.isAbsolute(trimmed)) {
    return path.resolve(trimmed);
  }
  if (baseDir) {
    return path.resolve(baseDir, trimmed);
  }
  return null;
}

function resolveBaseDirFromIdentity(
  baselineIdentity: string | undefined,
  fallbackCwd: string | null,
): string | null {
  if (baselineIdentity) {
    try {
      const parsed = JSON.parse(baselineIdentity) as { projectRoot?: unknown };
      if (typeof parsed.projectRoot === 'string') {
        const rawRoot = parsed.projectRoot.trim();
        if (path.isAbsolute(rawRoot)) {
          return path.resolve(rawRoot);
        }
        if (fallbackCwd) {
          return path.resolve(fallbackCwd, rawRoot);
        }
      }
    } catch {
      // ignore malformed baselineIdentity
    }
  }
  if (fallbackCwd) {
    const gitTop = resolveGitTopLevel(fallbackCwd);
    return gitTop ? path.resolve(gitTop) : path.resolve(fallbackCwd);
  }
  return null;
}

/**
 * Folds all visible `agent-instructions` messages from `agent.session.surface.nodes`
 * AND the current `decision.messages` (captured via `{ prepend: true }` waterfall)
 * to obtain the exact set of paths already loaded by `@deepseek-ai/dsh-agent-instructions`.
 */
export function extractHostLoadedPaths(
  agent: Agent,
  decisionMessages: readonly UserMessage[],
  fallbackCwd: string | null,
  homeDir: string,
): { active: boolean; paths: Set<string> } {
  const activeByScope = new Map<string, string>();
  let active = false;
  let lastBaseDir: string | null = resolveBaseDirFromIdentity(undefined, fallbackCwd);

  const foldSource = (rawSource: unknown): void => {
    if (!rawSource || typeof rawSource !== 'object') return;
    const src = rawSource as Partial<HostAgentInstructionsSource>;
    if (src.kind !== 'agent-instructions') return;
    active = true;
    const candidateBase = resolveBaseDirFromIdentity(src.baselineIdentity, fallbackCwd);
    if (candidateBase) lastBaseDir = candidateBase;
    if (!Array.isArray(src.changes)) return;
    for (const ch of src.changes) {
      if (!ch || typeof ch !== 'object') continue;
      const scopeKey = typeof ch.scope === 'string' && ch.scope ? ch.scope : ch.path;
      if (!scopeKey) continue;
      if (ch.action === 'remove') {
        activeByScope.delete(scopeKey);
      } else if (typeof ch.path === 'string') {
        const abs = resolveChangePath(ch.path, lastBaseDir, homeDir);
        if (abs) activeByScope.set(scopeKey, abs);
      }
    }
  };

  for (const seq of agent.session.surface.nodes) {
    const ev = agent.session.eventAt(seq);
    if (ev?.type === 'user/message') {
      foldSource(ev.data.source);
    }
  }
  for (const msg of decisionMessages) {
    foldSource(msg.source);
  }

  return { active, paths: new Set(activeByScope.values()) };
}

function findVisibleBaselineSource(
  agent: Agent,
  decisionMessages: readonly UserMessage[],
): UnifiedMemoryMessageSource | undefined {
  for (let i = decisionMessages.length - 1; i >= 0; i--) {
    const src = decisionMessages[i].source as unknown as Partial<UnifiedMemoryMessageSource> | undefined;
    if (src?.kind === UNIFIED_MEMORY_SOURCE_KIND && src.baseline === true) {
      return src as UnifiedMemoryMessageSource;
    }
  }
  const nodes = agent.session.surface.nodes;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const ev = agent.session.eventAt(nodes[i]);
    if (ev?.type === 'user/message') {
      const src = ev.data.source as unknown as Partial<UnifiedMemoryMessageSource> | undefined;
      if (src?.kind === UNIFIED_MEMORY_SOURCE_KIND && src.baseline === true) {
        return src as UnifiedMemoryMessageSource;
      }
    }
  }
  return undefined;
}

/**
 * Extracts file path(s) touched by DSH built-in file tools:
 * - `read`, `read_image`, `write`, `edit` -> `args.file_path`
 * - `str_replace_editor` -> `args.path`
 * - `apply_patch` -> parses `*** (Add|Update|Delete) File: <path>` & `*** Move to: <path>`
 */
export function extractFilePathsFromExecution(exec: ToolExecution): string[] {
  const args = exec.arguments;
  if (!args || typeof args !== 'object') return [];
  const rec = args as Record<string, unknown>;

  if (
    exec.name === 'read' ||
    exec.name === 'read_image' ||
    exec.name === 'write' ||
    exec.name === 'edit'
  ) {
    if (typeof rec.file_path === 'string' && rec.file_path.trim().length > 0) {
      return [rec.file_path.trim()];
    }
    return [];
  }

  if (exec.name === 'str_replace_editor') {
    if (typeof rec.path === 'string' && rec.path.trim().length > 0) {
      return [rec.path.trim()];
    }
    return [];
  }

  if (exec.name === 'apply_patch') {
    const input = typeof rec.input === 'string' ? rec.input : '';
    if (!input) return [];
    const found = new Set<string>();
    const rx = /^\*\*\*\s+(?:(?:Add|Update|Delete)\s+File|Move to):\s*(.+)$/gm;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(input)) !== null) {
      const p = m[1]?.trim();
      if (p) found.add(p);
    }
    return Array.from(found);
  }

  return [];
}

interface BaselineBuildResult {
  text: string;
  labels: string[];
  indexedConditionalRules: IndexedConditionalRule[];
  loadedAlwaysOnRules: LiveSessionRuleItem[];
  pendingExternalApprovalCount: number;
  fileMtimes: Record<string, number>;
  resolvedProjectRoot: string | null;
  claudeSlug: string | null;
  claudeMemoryIndex: LiveSessionContextSnapshot['claudeMemoryIndex'];
  codexSummaryInjected: boolean;
}

function buildBaselineInjection(
  cwd: string,
  config: UnifiedMemoryConfig,
  runtime: HostRuntime,
  locale: ResolvedLocale,
  hostLoadedPaths: ReadonlySet<string>,
  reason: 'session_start' | 'compaction_reload',
): BaselineBuildResult {
  const msg = getMessages(locale);
  const rulesLoaded = loadClaudeRulesForWorkspaces([cwd], {
    claudeConfigDir: runtime.claudeConfigDir,
    homeDir: runtime.homeDir,
    deduplicateNativeAgentsMd: config.deduplicateNativeAgentsMd,
    nativeRuleFilenames: DEFAULT_NATIVE_RULE_FILENAMES,
    hostName: DEFAULT_HOST_NAME,
    alreadyLoadedPaths: hostLoadedPaths,
    trustClaudeCodeExternalApprovals: config.trustClaudeCodeExternalApprovals,
    externalRuleTrust: config.externalRuleTrust,
  });

  const sections: string[] = [];
  const labels: string[] = [];
  const fileMtimes: Record<string, number> = {};
  const indexedConditionalRules: IndexedConditionalRule[] = [];
  const loadedAlwaysOnRules: LiveSessionRuleItem[] = [];
  let pendingExternalApprovalCount = 0;

  sections.push(
    reason === 'compaction_reload'
      ? msg.baselineHeaderCompactionReload
      : msg.baselineHeaderSessionStart,
  );

  const renderRuleEntry = (r: ClaudeRuleEntry): string | null => {
    fileMtimes[r.filePath] = r.mtimeMs;
    loadedAlwaysOnRules.push({
      displayPath: r.displayPath,
      filePath: r.filePath,
      scope: r.scope,
      dedupedByHost: r.dedupedByHost,
      importsCount: r.imports.length,
    });
    if (r.dedupedByHost) {
      if (r.importedOnlyContent.trim().length === 0) {
        return null;
      }
      labels.push(`${r.scope}:imports-only:${r.displayPath}`);
      return `### ${msg.hostDedupedImportOnlySubtitle(r.displayPath)}\n${r.importedOnlyContent}`;
    }
    labels.push(`${r.scope}:${r.displayPath}`);
    return `### ${r.displayPath} (${r.scope})\n${r.content}`;
  };

  // 1. Global Managed + ~/.claude/CLAUDE.md + unconditional ~/.claude/rules/
  if (rulesLoaded.globalAlwaysOn.length > 0) {
    const blocks: string[] = [];
    for (const r of rulesLoaded.globalAlwaysOn) {
      const rendered = renderRuleEntry(r);
      if (rendered) blocks.push(rendered);
    }
    if (blocks.length > 0) {
      sections.push(`${msg.sectionGlobalClaudeInstructions}\n${blocks.join('\n\n')}`);
    }
  }

  for (const gc of rulesLoaded.globalConditional) {
    indexedConditionalRules.push({
      id: `${gc.id}::${cwd}`,
      filePath: gc.filePath,
      displayPath: gc.displayPath,
      workspaceRoot: cwd,
      paths: gc.paths ?? [],
      scope: gc.scope,
    });
  }

  // 2. Active Workspace CLAUDE.md, `.claude/rules/`, and Claude Auto Memory MEMORY.md
  let resolvedProjectRoot: string | null = null;
  let claudeSlug: string | null = null;
  let claudeMemoryIndex: LiveSessionContextSnapshot['claudeMemoryIndex'] = null;

  for (const wsBundle of rulesLoaded.workspaces) {
    const wsName = path.basename(wsBundle.workspaceRoot) || wsBundle.workspaceRoot;
    const dormantConditionalFiles = new Set(wsBundle.conditional.map((c) => c.filePath));
    const wsPendingExternal = wsBundle.blockedExternalTargets.filter(
      (b) => b.status === 'pending_approval' && !dormantConditionalFiles.has(b.sourceFile),
    ).length;
    pendingExternalApprovalCount += wsPendingExternal;

    const blocks: string[] = [];
    for (const r of wsBundle.alwaysOn) {
      const rendered = renderRuleEntry(r);
      if (rendered) blocks.push(rendered);
    }
    if (wsPendingExternal > 0) {
      labels.push(`blocked-external:${wsName}:${wsPendingExternal}`);
      blocks.push(msg.pendingExternalRuleNotice(wsPendingExternal));
    }
    if (blocks.length > 0) {
      sections.push(
        `${msg.sectionProjectClaudeInstructions(wsName, wsBundle.workspaceRoot)}\n${blocks.join('\n\n')}`,
      );
    }

    for (const cond of wsBundle.conditional) {
      indexedConditionalRules.push({
        id: cond.id,
        filePath: cond.filePath,
        displayPath: cond.displayPath,
        workspaceRoot: wsBundle.workspaceRoot,
        paths: cond.paths ?? [],
        scope: cond.scope,
      });
    }

    const resolution = resolveClaudeProject(wsBundle.workspaceRoot, {
      claudeConfigDir: runtime.claudeConfigDir,
      env: runtime.env,
    });
    resolvedProjectRoot = resolution.resolvedRoot;
    claudeSlug = resolution.slug;

    if (resolution.autoMemoryEnabled) {
      const memIndex = readMemoryIndex(resolution.memoryDir);
      const topics = listTopicMemories(resolution.memoryDir);
      claudeMemoryIndex = {
        exists: memIndex.exists,
        totalLines: memIndex.totalLines,
        maxLines: memIndex.maxLines,
        totalBytes: memIndex.totalBytes,
        maxBytes: memIndex.maxBytes,
        truncated: memIndex.truncated,
        topicCount: topics.length,
      };
      if (memIndex.exists && memIndex.truncatedContent.trim()) {
        fileMtimes[memIndex.filePath] = memIndex.mtimeMs;
        labels.push(`claude-memory:${resolution.slug}`);
        const truncNote = memIndex.truncated
          ? `\n${msg.claudeMemoryTruncatedNote(
              memIndex.includedLines,
              memIndex.totalLines,
              (memIndex.includedBytes / 1024).toFixed(1),
              (memIndex.totalBytes / 1024).toFixed(1),
            )}`
          : '';
        sections.push(
          `${msg.sectionClaudeMemoryIndex(wsName)}\n` +
            `${msg.claudeMemoryCanonicalDirLine(resolution.memoryDir, resolution.slug, resolution.isGitWorktree)}\n` +
            `${msg.claudeMemoryToolsHintLine}\n\n` +
            `${memIndex.truncatedContent}${truncNote}`,
        );
      } else {
        sections.push(
          `${msg.sectionClaudeMemoryEmpty(wsName)}\n` +
            `${msg.claudeMemoryEmptyLine(resolution.memoryDir)}`,
        );
      }
    }
  }

  // 3. Codex Global Memory Summary (strictly read-only)
  let codexSummaryInjected = false;
  if (config.injectCodexSummaryOnStart) {
    const codexSummary = readCodexSummary({
      codexHome: runtime.codexHome,
      generation: 'auto',
      maxBytes: config.codexSummaryMaxBytes,
    });
    if (codexSummary.generation !== 'none' && codexSummary.content.trim()) {
      codexSummaryInjected = true;
      if (codexSummary.filePath) {
        fileMtimes[codexSummary.filePath] = codexSummary.mtimeMs;
      }
      labels.push(`codex-${codexSummary.generation}:memory_summary.md`);
      const truncNote = codexSummary.truncated
        ? `\n${msg.codexSummaryTruncatedNote((config.codexSummaryMaxBytes / 1024).toFixed(1))}`
        : '';
      sections.push(
        `${msg.sectionCodexSummary(codexSummary.generation)}\n` +
          `${msg.codexReadOnlyNoticeLine}\n\n` +
          `${codexSummary.content}${truncNote}`,
      );
    }
  }

  if (config.injectCodexGlobalAgentsMd) {
    const codexAgents = readCodexGlobalAgentsMd(runtime.codexHome);
    if (codexAgents && codexAgents.content) {
      const filename = codexAgents.isOverride ? 'AGENTS.override.md' : 'AGENTS.md';
      labels.push(`codex:${filename}`);
      sections.push(`${msg.sectionCodexGlobalAgents(filename)}\n${codexAgents.content}`);
    }
  }

  if (sections.length <= 1) {
    return {
      text: '',
      labels,
      indexedConditionalRules,
      loadedAlwaysOnRules,
      pendingExternalApprovalCount,
      fileMtimes,
      resolvedProjectRoot,
      claudeSlug,
      claudeMemoryIndex,
      codexSummaryInjected,
    };
  }

  const joined = sections.join('\n\n---\n\n');
  const clamped = clampUtf8(joined, config.maxStartupInjectBytes);
  const finalText = clamped.truncated
    ? `${clamped.content}\n\n${msg.startupContextTruncatedNote((config.maxStartupInjectBytes / 1024).toFixed(0))}`
    : clamped.content;

  return {
    text: finalText,
    labels,
    indexedConditionalRules,
    loadedAlwaysOnRules,
    pendingExternalApprovalCount,
    fileMtimes,
    resolvedProjectRoot,
    claudeSlug,
    claudeMemoryIndex,
    codexSummaryInjected,
  };
}

export function registerContextLifecycle(ctx: Context, runtime: HostRuntime): void {
  // PTC-safe touch tracking matching `@deepseek-ai/dsh-agent-instructions` commit boundaries:
  // 1. Nested calls (`exec.parent !== undefined`) bubble touches up to their root execution token.
  // 2. Touches arriving during an open step wait for `session/event` (`step/end`) before committing
  //    to `committedTouches`, which is then drained deterministically on the next `agent/pre-step`.
  const executionTouches = new Map<ToolExecutionToken, FileTouch[]>();
  const stepTouches = new WeakMap<Session, FileTouch[]>();
  const committedTouches = new WeakMap<Session, FileTouch[]>();
  const ruleTriggersBySession = new Map<string, Map<string, string>>();
  const subdirRecordsBySession = new Map<string, Map<string, LiveSessionSubdirRuleItem>>();

  ctx.effect(() => () => {
    executionTouches.clear();
    ruleTriggersBySession.clear();
    subdirRecordsBySession.clear();
  });

  ctx.on('agent/disposed', ({ agent }) => {
    const sid = String(agent.id);
    ruleTriggersBySession.delete(sid);
    subdirRecordsBySession.delete(sid);
  });

  const stepIsOpen = (session: Session): boolean => {
    try {
      const boundary = ctx.agents.turnBoundaryOf(session);
      return (
        boundary.openTurnStartSeq !== null &&
        boundary.lastStepBoundary?.kind === 'start' &&
        boundary.lastStepBoundary.seq > boundary.openTurnStartSeq
      );
    } catch {
      return false;
    }
  };

  const commitTouch = (touch: FileTouch): void => {
    const sess = touch.agent.session;
    const list = committedTouches.get(sess);
    if (list) list.push(touch);
    else committedTouches.set(sess, [touch]);
  };

  const scheduleTouch = (touch: FileTouch): void => {
    const sess = touch.agent.session;
    if (!stepIsOpen(sess)) {
      commitTouch(touch);
      return;
    }
    const list = stepTouches.get(sess);
    if (list) list.push(touch);
    else stepTouches.set(sess, [touch]);
  };

  ctx.on('session/event', (session, event) => {
    if (event.type !== 'step/end') return;
    const pending = stepTouches.get(session);
    if (!pending) return;
    stepTouches.delete(session);
    for (const touch of pending) {
      commitTouch(touch);
    }
  });

  ctx.on('tools/result', (exec: ToolExecution, result: ToolExecutionResult) => {
    const collected = executionTouches.get(exec.token) ?? [];
    executionTouches.delete(exec.token);

    if (!result.isError && exec.agent !== undefined && !exec.signal.aborted) {
      const touchedPaths = extractFilePathsFromExecution(exec);
      for (const filePath of touchedPaths) {
        collected.push({ agent: exec.agent, filePath, toolName: exec.name });
      }
    }

    if (exec.parent !== undefined) {
      if (collected.length > 0) {
        const parentList = executionTouches.get(exec.parent);
        if (parentList) parentList.push(...collected);
        else executionTouches.set(exec.parent, collected);
      }
      return;
    }

    for (const touch of collected) {
      scheduleTouch(touch);
    }
  });

  const hydrateLiveSnapshot = (
    agent: Agent,
    state: SessionState,
    locale: ResolvedLocale,
    hostActive: boolean,
    hostPaths: ReadonlySet<string>,
    opts: {
      baselineInjected: boolean;
      baselineInjectedAt?: string | null;
      baselineBytes?: number;
      injectedLabels?: string[];
      loadedAlwaysOnRules?: LiveSessionRuleItem[];
      pendingExternalApprovalCount?: number;
      resolvedProjectRoot?: string | null;
      claudeSlug?: string | null;
      claudeMemoryIndex?: LiveSessionContextSnapshot['claudeMemoryIndex'];
      codexSummaryInjected?: boolean;
    },
  ): void => {
    const sid = String(agent.id);
    const prev = runtime.liveSessions.get(sid);
    const triggers = ruleTriggersBySession.get(sid);
    const loadedRuleSet = new Set(state.loadedRuleKeys);
    const indexedConditionalRules: LiveSessionConditionalRuleItem[] =
      state.indexedConditionalRules.map((r) => ({
        id: r.id,
        displayPath: r.displayPath,
        filePath: r.filePath,
        paths: r.paths,
        scope: r.scope,
        loaded: loadedRuleSet.has(r.id),
        triggeredBy: triggers?.get(r.id),
      }));
    const subdirMap = subdirRecordsBySession.get(sid);
    const loadedSubdirClaudeMds: LiveSessionSubdirRuleItem[] = subdirMap
      ? Array.from(subdirMap.values())
      : state.loadedSubdirPaths.map((k) => ({
          displayPath: path.basename(k),
          filePath: k,
          triggeredBy: '',
        }));

    runtime.liveSessions.set(sid, {
      sessionId: sid,
      cwd: state.lastBaselineCwd ?? state.workspacePaths[0] ?? null,
      resolvedProjectRoot: opts.resolvedProjectRoot ?? prev?.resolvedProjectRoot ?? null,
      claudeSlug: opts.claudeSlug ?? prev?.claudeSlug ?? null,
      resolvedLocale: locale,
      origin: agent.session.header.origin === 'subagent' ? 'subagent' : 'root',
      isSeeded: Boolean(agent.session.header.isSeeded),
      baselineInjected: opts.baselineInjected,
      baselineInjectedAt:
        opts.baselineInjectedAt !== undefined
          ? opts.baselineInjectedAt
          : (prev?.baselineInjectedAt ?? null),
      baselineBytes: opts.baselineBytes ?? prev?.baselineBytes ?? 0,
      replaceGeneration: agent.session.surface.replaceGeneration,
      compactionCount: state.compactionCount,
      hostAgentInstructionsActive: hostActive || (prev?.hostAgentInstructionsActive ?? false),
      hostLoadedPaths: Array.from(hostPaths).sort(),
      injectedLabels: opts.injectedLabels ?? prev?.injectedLabels ?? [],
      loadedAlwaysOnRules: opts.loadedAlwaysOnRules ?? prev?.loadedAlwaysOnRules ?? [],
      indexedConditionalRules,
      loadedSubdirClaudeMds,
      pendingExternalApprovalCount:
        opts.pendingExternalApprovalCount ?? prev?.pendingExternalApprovalCount ?? 0,
      claudeMemoryIndex:
        opts.claudeMemoryIndex !== undefined
          ? opts.claudeMemoryIndex
          : (prev?.claudeMemoryIndex ?? null),
      codexSummaryInjected: opts.codexSummaryInjected ?? prev?.codexSummaryInjected ?? false,
      updatedAt: new Date().toISOString(),
    });
  };

  // CRITICAL: `{ prepend: true }` places us OUTER to `@deepseek-ai/dsh-agent-instructions`
  // in the `agent/pre-step` waterfall so `await next()` already includes any `agent-instructions`
  // message and its exact `source.changes[]` list for zero-guesswork runtime deduplication.
  ctx.on(
    'agent/pre-step',
    async ({ agent, messages, step, signal }, next): Promise<PreStepDecision> => {
      const t0 = performance.now();
      const decision = await next();
      if (decision.kind !== 'enter') return decision;
      // Preserve DSH empty first-step turn invariant (do not force a request on an empty wake)
      if (step === 1 && decision.messages.length === 0) return decision;
      if (signal.aborted) return decision;

      const sessionId = String(agent.id);
      const cwd = await runtime.resolveAgentCwd(agent, signal);
      if (!cwd) return decision;

      const config = runtime.getEffectiveConfig();
      const hostInfo = extractHostLoadedPaths(agent, decision.messages, cwd, runtime.homeDir);
      const visibleBaseline = findVisibleBaselineSource(agent, decision.messages);
      const replaceGeneration = agent.session.surface.replaceGeneration;

      let state = loadSessionState(sessionId, runtime.dataDir);
      const isFreshState = state === null;
      if (!state) {
        gcStaleSessions(runtime.dataDir);
        state = createEmptySessionState(sessionId, [cwd]);
      }

      const forcedReload = runtime.pendingReloadSessions.delete(sessionId);
      const cwdChanged =
        visibleBaseline !== undefined &&
        visibleBaseline.cwd !== undefined &&
        path.resolve(visibleBaseline.cwd) !== path.resolve(cwd);
      const emptyBaselineAlreadyEvaluated =
        visibleBaseline === undefined &&
        state.sessionStarted &&
        state.lastBaselineCwd !== undefined &&
        path.resolve(state.lastBaselineCwd) === path.resolve(cwd) &&
        state.lastReplaceGeneration === replaceGeneration;
      const isCompactionReload =
        visibleBaseline === undefined &&
        !emptyBaselineAlreadyEvaluated &&
        (replaceGeneration > 0 ||
          (state.sessionStarted && replaceGeneration > (state.lastReplaceGeneration ?? 0)));
      const needsBaseline =
        forcedReload ||
        cwdChanged ||
        (visibleBaseline === undefined && !emptyBaselineAlreadyEvaluated);

      // Session-locked locale: resolve fresh only on baseline (re)injection, reuse locked locale mid-session
      const sessionLocale: ResolvedLocale = needsBaseline
        ? runtime.resolveEffectiveLocale()
        : (visibleBaseline?.locale ?? state.locale ?? runtime.resolveEffectiveLocale());

      const injectedMessages: UserMessage[] = [];
      let stateDirty = isFreshState;

      // Keep host-deduped path inventory fresh
      const hostPathsSorted = Array.from(hostInfo.paths).sort();
      if (JSON.stringify(state.hostDedupedPaths ?? []) !== JSON.stringify(hostPathsSorted)) {
        state.hostDedupedPaths = hostPathsSorted;
        stateDirty = true;
      }

      if (needsBaseline) {
        const reason: 'session_start' | 'compaction_reload' = isCompactionReload
          ? 'compaction_reload'
          : 'session_start';
        const baseline = buildBaselineInjection(
          cwd,
          config,
          runtime,
          sessionLocale,
          hostInfo.paths,
          reason,
        );

        state.sessionStarted = true;
        state.locale = sessionLocale;
        state.workspacePaths = [cwd];
        state.lastBaselineCwd = cwd;
        state.lastReplaceGeneration = replaceGeneration;
        state.indexedConditionalRules = baseline.indexedConditionalRules;
        state.fileMtimes = baseline.fileMtimes;
        if (isCompactionReload || forcedReload || cwdChanged) {
          if (isCompactionReload) state.compactionCount += 1;
          state.loadedRuleKeys = [];
          state.loadedSubdirPaths = [];
          ruleTriggersBySession.delete(sessionId);
          subdirRecordsBySession.delete(sessionId);
        }
        stateDirty = true;

        const nowIso = new Date().toISOString();
        let baselineBytes = 0;
        if (baseline.text) {
          const wrapped = wrapSystemReminder(baseline.text);
          baselineBytes = Buffer.byteLength(wrapped, 'utf8');
          const baselineSource: UnifiedMemoryMessageSource = {
            kind: UNIFIED_MEMORY_SOURCE_KIND,
            form: 'instructions',
            baseline: true,
            cwd,
            locale: sessionLocale,
            replaceGeneration,
          };
          injectedMessages.push(
            createUserMessage({
              content: [{ type: 'text', text: wrapped }],
              source: baselineSource as unknown as UserMessage['source'],
            }),
          );
        }

        hydrateLiveSnapshot(agent, state, sessionLocale, hostInfo.active, hostInfo.paths, {
          baselineInjected: baseline.text.length > 0,
          baselineInjectedAt: baseline.text.length > 0 ? nowIso : null,
          baselineBytes,
          injectedLabels: baseline.labels,
          loadedAlwaysOnRules: baseline.loadedAlwaysOnRules,
          pendingExternalApprovalCount: baseline.pendingExternalApprovalCount,
          resolvedProjectRoot: baseline.resolvedProjectRoot,
          claudeSlug: baseline.claudeSlug,
          claudeMemoryIndex: baseline.claudeMemoryIndex,
          codexSummaryInjected: baseline.codexSummaryInjected,
        });

        appendDiagnosticEvent(
          {
            ts: nowIso,
            event: isCompactionReload ? 'CompactionReload' : forcedReload ? 'ManualReload' : 'BaselineInject',
            conversationId: sessionId,
            elapsedMs: Number((performance.now() - t0).toFixed(2)),
            workspacePaths: [cwd],
            cwd,
            locale: sessionLocale,
            hostDedupedCount: hostPathsSorted.length,
            injectedCount: baseline.text ? 1 : 0,
            injectedLabels: baseline.labels,
            compactionReload: isCompactionReload || undefined,
          },
          runtime.dataDir,
        );
      } else if (!runtime.liveSessions.has(sessionId)) {
        // Hydrate live snapshot for resumed sessions or forked subagents (`isSeeded: true`)
        // WITHOUT re-injecting duplicate baseline context (preserves 100% KV-cache prefix!).
        if (!state.sessionStarted) {
          state.sessionStarted = true;
          state.locale = sessionLocale;
          state.workspacePaths = [cwd];
          state.lastBaselineCwd = visibleBaseline?.cwd ?? cwd;
          state.lastReplaceGeneration = replaceGeneration;
          // Index conditional rules so mid-session file touches still work on resumed/forked sessions
          const rulesOnly = loadClaudeRulesForWorkspaces([cwd], {
            claudeConfigDir: runtime.claudeConfigDir,
            homeDir: runtime.homeDir,
            deduplicateNativeAgentsMd: config.deduplicateNativeAgentsMd,
            nativeRuleFilenames: DEFAULT_NATIVE_RULE_FILENAMES,
            hostName: DEFAULT_HOST_NAME,
            alreadyLoadedPaths: hostInfo.paths,
            trustClaudeCodeExternalApprovals: config.trustClaudeCodeExternalApprovals,
            externalRuleTrust: config.externalRuleTrust,
          });
          state.indexedConditionalRules = [
            ...rulesOnly.globalConditional.map((gc) => ({
              id: `${gc.id}::${cwd}`,
              filePath: gc.filePath,
              displayPath: gc.displayPath,
              workspaceRoot: cwd,
              paths: gc.paths ?? [],
              scope: gc.scope,
            })),
            ...rulesOnly.workspaces.flatMap((ws) =>
              ws.conditional.map((c) => ({
                id: c.id,
                filePath: c.filePath,
                displayPath: c.displayPath,
                workspaceRoot: ws.workspaceRoot,
                paths: c.paths ?? [],
                scope: c.scope,
              })),
            ),
          ];
          stateDirty = true;
        }
        const resolution = resolveClaudeProject(cwd, {
          claudeConfigDir: runtime.claudeConfigDir,
          env: runtime.env,
        });
        const memIndex = resolution.autoMemoryEnabled
          ? readMemoryIndex(resolution.memoryDir)
          : null;
        const topics = resolution.autoMemoryEnabled
          ? listTopicMemories(resolution.memoryDir)
          : [];
        hydrateLiveSnapshot(agent, state, sessionLocale, hostInfo.active, hostInfo.paths, {
          baselineInjected: visibleBaseline !== undefined,
          resolvedProjectRoot: resolution.resolvedRoot,
          claudeSlug: resolution.slug,
          claudeMemoryIndex: memIndex
            ? {
                exists: memIndex.exists,
                totalLines: memIndex.totalLines,
                maxLines: memIndex.maxLines,
                totalBytes: memIndex.totalBytes,
                maxBytes: memIndex.maxBytes,
                truncated: memIndex.truncated,
                topicCount: topics.length,
              }
            : null,
        });
      }

      // Drain committed file touches from prior step (`tools/result` + `step/end`)
      const touches = committedTouches.get(agent.session);
      if (touches && touches.length > 0) {
        committedTouches.delete(agent.session);
        const msg = getMessages(sessionLocale);
        const loadedRules = new Set(state.loadedRuleKeys);
        const loadedSubdirs = new Set(state.loadedSubdirPaths);
        const lazyBlocks: string[] = [];
        const lazyLabels: string[] = [];
        let lastToolName: string | undefined;
        let lastTriggeredPath: string | undefined;

        let triggerMap = ruleTriggersBySession.get(sessionId);
        if (!triggerMap) {
          triggerMap = new Map<string, string>();
          ruleTriggersBySession.set(sessionId, triggerMap);
        }
        let subdirMap = subdirRecordsBySession.get(sessionId);
        if (!subdirMap) {
          subdirMap = new Map<string, LiveSessionSubdirRuleItem>();
          subdirRecordsBySession.set(sessionId, subdirMap);
        }

        const dedupTrustOpts = {
          claudeConfigDir: runtime.claudeConfigDir,
          homeDir: runtime.homeDir,
          deduplicateNativeAgentsMd: config.deduplicateNativeAgentsMd,
          nativeRuleFilenames: DEFAULT_NATIVE_RULE_FILENAMES,
          hostName: DEFAULT_HOST_NAME,
          alreadyLoadedPaths: hostInfo.paths,
          trustClaudeCodeExternalApprovals: config.trustClaudeCodeExternalApprovals,
          externalRuleTrust: config.externalRuleTrust,
        };

        for (const touch of touches) {
          const accessedAbs = path.isAbsolute(touch.filePath)
            ? path.resolve(touch.filePath)
            : path.resolve(cwd, touch.filePath);
          lastToolName = touch.toolName;
          lastTriggeredPath = accessedAbs;

          // 1. Match path-scoped `.claude/rules/*.md`
          for (const rule of state.indexedConditionalRules) {
            if (loadedRules.has(rule.id)) continue;
            const wsRoot = path.resolve(rule.workspaceRoot);
            if (accessedAbs !== wsRoot && !accessedAbs.startsWith(wsRoot + path.sep)) continue;
            const relPath = path.relative(wsRoot, accessedAbs).replace(/\\/g, '/');
            if (!matchesGlobPatterns(relPath, rule.paths)) continue;

            loadedRules.add(rule.id);
            triggerMap.set(rule.id, relPath);
            stateDirty = true;

            const res = loadConditionalRuleContentWithDiagnostics(
              rule.filePath,
              wsRoot,
              rule.scope,
              dedupTrustOpts,
            );
            const pendingCount = res.blocked.filter((b) => b.status === 'pending_approval').length;
            const subtitle = msg.scopedRuleMatchedSubtitle(rule.displayPath, relPath);
            if (res.entry) {
              const note = pendingCount > 0 ? `\n\n${msg.pendingExternalRuleNotice(pendingCount)}` : '';
              lazyBlocks.push(`### ${subtitle}\n${res.entry.content}${note}`);
              lazyLabels.push(`lazy-rule:${rule.displayPath}`);
            } else if (pendingCount > 0) {
              lazyBlocks.push(`### ${subtitle}\n${msg.pendingExternalRuleNotice(pendingCount)}`);
              lazyLabels.push(`lazy-blocked-rule:${rule.displayPath}`);
            }
          }

          // 2. Discover lazy subdirectory CLAUDE.md / .claude/CLAUDE.md / CLAUDE.local.md
          const absWs = path.resolve(cwd);
          if (accessedAbs === absWs || accessedAbs.startsWith(absWs + path.sep)) {
            const relTriggered = path.relative(absWs, accessedAbs).replace(/\\/g, '/');
            const subRes = findSubdirectoryClaudeMdsWithDiagnostics(
              accessedAbs,
              absWs,
              dedupTrustOpts,
            );
            const seenFiles = new Set<string>();
            for (const sub of subRes.entries) {
              seenFiles.add(sub.filePath);
              if (loadedSubdirs.has(sub.id)) continue;
              loadedSubdirs.add(sub.id);
              subdirMap.set(sub.id, {
                displayPath: sub.displayPath,
                filePath: sub.filePath,
                triggeredBy: relTriggered,
              });
              stateDirty = true;

              const pendingCount = sub.blockedExternalTargets.filter(
                (b) => b.status === 'pending_approval',
              ).length;
              const note = pendingCount > 0 ? `\n\n${msg.pendingExternalRuleNotice(pendingCount)}` : '';

              if (sub.dedupedByHost) {
                if (sub.importedOnlyContent.trim().length > 0) {
                  lazyBlocks.push(
                    `### ${msg.hostDedupedImportOnlySubtitle(sub.displayPath)}\n${sub.importedOnlyContent}${note}`,
                  );
                  lazyLabels.push(`lazy-subdir-imports:${sub.displayPath}`);
                } else if (pendingCount > 0) {
                  lazyBlocks.push(
                    `### ${msg.subdirClaudeMdTriggeredSubtitle(sub.displayPath, relTriggered)}\n${msg.pendingExternalRuleNotice(pendingCount)}`,
                  );
                  lazyLabels.push(`lazy-blocked-subdir:${sub.displayPath}`);
                }
              } else {
                lazyBlocks.push(
                  `### ${msg.subdirClaudeMdTriggeredSubtitle(sub.displayPath, relTriggered)}\n${sub.content}${note}`,
                );
                lazyLabels.push(`lazy-subdir:${sub.displayPath}`);
              }
            }
            for (const blk of subRes.blocked) {
              if (blk.status !== 'pending_approval') continue;
              if (seenFiles.has(blk.sourceFile)) continue;
              const blockedKey = `blocked:${blk.sourceFile}`;
              if (loadedSubdirs.has(blockedKey)) continue;
              loadedSubdirs.add(blockedKey);
              stateDirty = true;
              lazyBlocks.push(
                `### ${msg.subdirClaudeMdTriggeredSubtitle(blk.sourceDisplayPath, relTriggered)}\n${msg.pendingExternalRuleNotice(1)}`,
              );
              lazyLabels.push(`lazy-blocked-subdir:${blk.sourceDisplayPath}`);
            }
          }
        }

        state.loadedRuleKeys = Array.from(loadedRules);
        state.loadedSubdirPaths = Array.from(loadedSubdirs);

        if (lazyBlocks.length > 0) {
          const lazyText = `${msg.lazyHeaderScopedRules}\n\n${lazyBlocks.join('\n\n---\n\n')}`;
          const lazySource: UnifiedMemoryMessageSource = {
            kind: UNIFIED_MEMORY_SOURCE_KIND,
            form: 'recall',
            lazy: true,
            cwd,
            locale: sessionLocale,
          };
          injectedMessages.push(
            createUserMessage({
              content: [{ type: 'text', text: wrapSystemReminder(lazyText) }],
              source: lazySource as unknown as UserMessage['source'],
            }),
          );
          appendDiagnosticEvent(
            {
              ts: new Date().toISOString(),
              event: 'LazyRuleInject',
              conversationId: sessionId,
              elapsedMs: Number((performance.now() - t0).toFixed(2)),
              workspacePaths: [cwd],
              cwd,
              locale: sessionLocale,
              hostDedupedCount: hostPathsSorted.length,
              injectedCount: lazyBlocks.length,
              injectedLabels: lazyLabels,
              toolName: lastToolName,
              triggeredBy: lastTriggeredPath,
            },
            runtime.dataDir,
          );
        }

        if (stateDirty) {
          hydrateLiveSnapshot(agent, state, sessionLocale, hostInfo.active, hostInfo.paths, {
            baselineInjected: runtime.liveSessions.get(sessionId)?.baselineInjected ?? true,
          });
        }
      }

      if (stateDirty) {
        try {
          saveSessionState(state, runtime.dataDir);
        } catch (err) {
          ctx.logger.warn('unified-memory: failed to save session state: %o', err);
        }
      }

      if (injectedMessages.length === 0) {
        return decision;
      }

      let lastClaimedIndex = -1;
      for (let i = decision.messages.length - 1; i >= 0; i--) {
        if (messages.includes(decision.messages[i])) {
          lastClaimedIndex = i;
          break;
        }
      }
      const insertAt = lastClaimedIndex + 1;
      const entered = [
        ...decision.messages.slice(0, insertAt),
        ...injectedMessages,
        ...decision.messages.slice(insertAt),
      ];
      return { ...decision, messages: entered };
    },
    { prepend: true },
  );

  // Ensure workspace dir exists check isn't unused
  void fs.existsSync;
}
