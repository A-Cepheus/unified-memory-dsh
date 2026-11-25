import fs from 'node:fs';
import path from 'node:path';
import type { Context } from '@deepseek-ai/cordis';
import type { ConnectionFetchMethod } from '@deepseek-ai/dsh-client-connection';
import {
  CLAUDE_MEMORY_TYPES,
  DEFAULT_HOST_NAME,
  DEFAULT_NATIVE_RULE_FILENAMES,
  clearDiagnosticEvents,
  deleteTopicMemory,
  discoverAllClaudeProjects,
  getCodexMemoryStatus,
  getMessages,
  getWorkspaceExternalTrust,
  listCodexFiles,
  listRecentSessions,
  listTopicMemories,
  loadClaudeRulesForWorkspaces,
  normalizeLocalePreference,
  readClaudeSettings,
  readCodexMemoryFile,
  readCodexSummary,
  readDiagnosticEvents,
  readMemoryIndex,
  readTopicMemory,
  resolveClaudeProject,
  saveTopicMemory,
  searchCodexMemories,
  updateWorkspaceExternalTrust,
  writeMemoryIndexRaw,
  type ClaudeMemoryType,
} from '../core/index.js';
import {
  API_PATHS,
  PLUGIN_VERSION,
  type ApiErrorResponse,
  type ClaudeDeleteRequest,
  type ClaudeDeleteResponse,
  type ClaudeListResponse,
  type ClaudeReadResponse,
  type ClaudeSaveIndexRequest,
  type ClaudeSaveIndexResponse,
  type ClaudeSaveRequest,
  type ClaudeSaveResponse,
  type CodexBrowseResponse,
  type CodexReadResponse,
  type CodexSearchRequest,
  type CodexSearchResponse,
  type CodexSummaryResponse,
  type ConfigUpdateRequest,
  type ConfigUpdateResponse,
  type DiagnosticsClearResponse,
  type OverviewResponse,
  type RulesInspectResponse,
  type SessionContextResponse,
  type TrustUpdateRequest,
  type TrustUpdateResponse,
} from '../shared/api-contract.js';
import type { HostRuntime } from './runtime.js';

function jsonOk<T>(body: T, status = 200): Response {
  return Response.json(body, { status });
}

function jsonErr(message: string, status = 400, code?: string): Response {
  const payload: ApiErrorResponse = code ? { error: message, code } : { error: message };
  return Response.json(payload, { status });
}

async function readJsonBody<T>(request: Request): Promise<T> {
  const text = await request.text();
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

function resolveTargetMemoryDir(
  params: { slug?: string | null; projectPath?: string | null },
  runtime: HostRuntime,
): { memoryDir: string; slug: string; resolvedRoot: string | null; autoMemoryEnabled: boolean } {
  if (params.projectPath && params.projectPath.trim().length > 0) {
    const res = resolveClaudeProject(params.projectPath.trim(), {
      claudeConfigDir: runtime.claudeConfigDir,
      env: runtime.env,
    });
    return {
      memoryDir: res.memoryDir,
      slug: res.slug,
      resolvedRoot: res.resolvedRoot,
      autoMemoryEnabled: res.autoMemoryEnabled,
    };
  }
  if (params.slug && params.slug.trim().length > 0) {
    const rawSlug = params.slug.trim();
    const cleanSlug = path.basename(rawSlug);
    if (cleanSlug !== rawSlug || cleanSlug.includes('..')) {
      throw new Error(`Invalid project slug: ${rawSlug}`);
    }
    const globalSettings = readClaudeSettings(undefined, runtime.claudeConfigDir, runtime.env);
    return {
      memoryDir: path.join(runtime.claudeConfigDir, 'projects', cleanSlug, 'memory'),
      slug: cleanSlug,
      resolvedRoot: null,
      autoMemoryEnabled: globalSettings.autoMemoryEnabled,
    };
  }
  throw new Error('Either projectPath or slug must be provided');
}

function parseOptionalInt(
  raw: string | null,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function buildOverviewResponse(runtime: HostRuntime, queryCwd: string | null): OverviewResponse {
  const claudeProjects = discoverAllClaudeProjects(runtime.claudeConfigDir, runtime.homeDir);
  const codexStatus = getCodexMemoryStatus(runtime.codexHome);
  const recentSessions = listRecentSessions(runtime.dataDir, 20);
  const activeSessions = runtime.listLiveSessionSummaries();
  const diagnostics = readDiagnosticEvents(runtime.dataDir, 80);
  const config = runtime.getEffectiveConfig();
  const resolvedLocale = runtime.resolveEffectiveLocale();
  const hostLocalePreference = runtime.getHostLocalePreference();

  const workspaceHintsSet = new Set<string>();
  if (queryCwd && queryCwd.trim().length > 0) {
    workspaceHintsSet.add(path.resolve(queryCwd.trim()));
  }
  for (const live of activeSessions) {
    if (live.cwd) workspaceHintsSet.add(live.cwd);
  }
  for (const s of recentSessions) {
    for (const ws of s.workspacePaths) {
      if (ws) workspaceHintsSet.add(ws);
    }
  }
  for (const p of claudeProjects) {
    if (p.exactPathResolved && fs.existsSync(p.displayPath)) {
      workspaceHintsSet.add(p.displayPath);
    }
  }

  return {
    version: PLUGIN_VERSION,
    pluginDataDir: runtime.dataDir,
    resolvedLocale,
    hostLocalePreference,
    claude: {
      configDir: runtime.claudeConfigDir,
      exists: fs.existsSync(runtime.claudeConfigDir),
      hasGlobalClaudeMd: fs.existsSync(path.join(runtime.claudeConfigDir, 'CLAUDE.md')),
      hasGlobalRulesDir: fs.existsSync(path.join(runtime.claudeConfigDir, 'rules')),
      projectCount: claudeProjects.length,
      totalTopics: claudeProjects.reduce((acc, p) => acc + p.topicCount, 0),
      projects: claudeProjects,
    },
    codex: codexStatus,
    activeSessions,
    recentSessions: recentSessions.map((s) => ({
      conversationId: s.conversationId,
      startedAt: s.startedAt,
      updatedAt: s.updatedAt,
      workspacePaths: s.workspacePaths,
      locale: s.locale,
      loadedRuleCount: s.loadedRuleKeys.length,
      loadedSubdirCount: s.loadedSubdirPaths.length,
      indexedConditionalCount: s.indexedConditionalRules.length,
      compactionCount: s.compactionCount,
      hostDedupedCount: s.hostDedupedPaths?.length ?? 0,
    })),
    diagnostics,
    config,
    workspaceHints: Array.from(workspaceHintsSet),
  };
}

export function registerHttpRoutes(ctx: Context, runtime: HostRuntime): void {
  ctx.inject(['connection'], (c) => {
    const mount = (
      routePath: string,
      methods: readonly ConnectionFetchMethod[],
      handler: (request: Request) => Promise<Response>,
    ) => {
      c.effect(() =>
        c.connection.fetch.register({
          path: routePath,
          methods,
          requestBody: 'buffered',
          fetch: async (request) => {
            try {
              return await handler(request);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              return jsonErr(message, 400);
            }
          },
        }),
      );
    };

    // 1. GET /api/unified-memory/overview
    mount(API_PATHS.OVERVIEW, ['GET'], async (request) => {
      const url = new URL(request.url);
      const cwd = url.searchParams.get('cwd');
      return jsonOk(buildOverviewResponse(runtime, cwd));
    });

    // 2. GET /api/unified-memory/claude/resolve
    mount(API_PATHS.CLAUDE_RESOLVE, ['GET'], async (request) => {
      const url = new URL(request.url);
      const inputPath = url.searchParams.get('path')?.trim();
      if (!inputPath) return jsonErr('Missing required query param: path', 400);
      const res = resolveClaudeProject(inputPath, {
        claudeConfigDir: runtime.claudeConfigDir,
        env: runtime.env,
      });
      return jsonOk(res);
    });

    // 3. GET /api/unified-memory/claude/list
    mount(API_PATHS.CLAUDE_LIST, ['GET'], async (request) => {
      const url = new URL(request.url);
      const target = resolveTargetMemoryDir(
        {
          projectPath: url.searchParams.get('projectPath'),
          slug: url.searchParams.get('slug'),
        },
        runtime,
      );
      const index = readMemoryIndex(target.memoryDir);
      const topics = listTopicMemories(target.memoryDir);
      const payload: ClaudeListResponse = {
        slug: target.slug,
        resolvedRoot: target.resolvedRoot,
        memoryDir: target.memoryDir,
        autoMemoryEnabled: target.autoMemoryEnabled,
        index,
        topics,
      };
      return jsonOk(payload);
    });

    // 4. GET /api/unified-memory/claude/read
    mount(API_PATHS.CLAUDE_READ, ['GET'], async (request) => {
      const url = new URL(request.url);
      const target = resolveTargetMemoryDir(
        {
          projectPath: url.searchParams.get('projectPath'),
          slug: url.searchParams.get('slug'),
        },
        runtime,
      );
      const filename = url.searchParams.get('filename')?.trim() ?? '';
      if (!filename || filename === 'MEMORY.md') {
        const payload: ClaudeReadResponse = {
          kind: 'index',
          slug: target.slug,
          memoryDir: target.memoryDir,
          index: readMemoryIndex(target.memoryDir),
        };
        return jsonOk(payload);
      }
      const topic = readTopicMemory(target.memoryDir, filename);
      if (!topic) {
        const msg = getMessages(runtime.resolveEffectiveLocale());
        return jsonErr(msg.topicNotFoundError(filename, target.memoryDir), 404, 'NOT_FOUND');
      }
      const payload: ClaudeReadResponse = {
        kind: 'topic',
        slug: target.slug,
        memoryDir: target.memoryDir,
        topic,
      };
      return jsonOk(payload);
    });

    // 5. POST /api/unified-memory/claude/save
    mount(API_PATHS.CLAUDE_SAVE, ['POST'], async (request) => {
      const body = await readJsonBody<ClaudeSaveRequest>(request);
      if (!body.name?.trim() || !body.description?.trim() || !body.body?.trim()) {
        return jsonErr('Fields name, description, and body are required', 400);
      }
      if (!CLAUDE_MEMORY_TYPES.includes(body.type as ClaudeMemoryType)) {
        return jsonErr(`Invalid memory type: ${String(body.type)}`, 400);
      }
      const target = resolveTargetMemoryDir(body, runtime);
      const locale = runtime.resolveEffectiveLocale();
      if (!target.autoMemoryEnabled) {
        return jsonErr(getMessages(locale).autoMemoryDisabledError, 403, 'AUTO_MEMORY_DISABLED');
      }
      const res = saveTopicMemory(target.memoryDir, {
        filename: body.filename,
        name: body.name,
        description: body.description,
        type: body.type,
        body: body.body,
        originSessionId: body.originSessionId,
        locale,
      });
      const payload: ClaudeSaveResponse = {
        slug: target.slug,
        topic: res.topic,
        index: res.index,
        warnings: res.warnings,
      };
      return jsonOk(payload);
    });

    // 6. POST /api/unified-memory/claude/delete
    mount(API_PATHS.CLAUDE_DELETE, ['POST'], async (request) => {
      const body = await readJsonBody<ClaudeDeleteRequest>(request);
      if (!body.filename?.trim()) {
        return jsonErr('Field filename is required', 400);
      }
      const target = resolveTargetMemoryDir(body, runtime);
      const res = deleteTopicMemory(target.memoryDir, body.filename.trim());
      const payload: ClaudeDeleteResponse = {
        slug: target.slug,
        deleted: res.deleted,
        index: res.index,
      };
      return jsonOk(payload);
    });

    // 7. POST /api/unified-memory/claude/save-index
    mount(API_PATHS.CLAUDE_SAVE_INDEX, ['POST'], async (request) => {
      const body = await readJsonBody<ClaudeSaveIndexRequest>(request);
      if (typeof body.content !== 'string') {
        return jsonErr('Field content must be a string', 400);
      }
      const target = resolveTargetMemoryDir(body, runtime);
      if (!target.autoMemoryEnabled) {
        const msg = getMessages(runtime.resolveEffectiveLocale());
        return jsonErr(msg.autoMemoryDisabledError, 403, 'AUTO_MEMORY_DISABLED');
      }
      const index = writeMemoryIndexRaw(target.memoryDir, body.content);
      const payload: ClaudeSaveIndexResponse = { slug: target.slug, index };
      return jsonOk(payload);
    });

    // 8. GET /api/unified-memory/codex/summary
    mount(API_PATHS.CODEX_SUMMARY, ['GET'], async (request) => {
      const url = new URL(request.url);
      const rawGen = url.searchParams.get('generation');
      const gen = rawGen === 'v2' || rawGen === 'v1' ? rawGen : 'auto';
      const maxBytes = parseOptionalInt(url.searchParams.get('maxBytes'), 512, 65536, 32 * 1024);
      const status = getCodexMemoryStatus(runtime.codexHome);
      const selectedGeneration: 'v2' | 'v1' =
        gen !== 'auto'
          ? gen
          : status.activeGeneration === 'none'
            ? 'v2'
            : status.activeGeneration;
      const summary = readCodexSummary({
        codexHome: runtime.codexHome,
        generation: selectedGeneration,
        maxBytes,
      });
      const payload: CodexSummaryResponse = {
        readOnly: true,
        status,
        selectedGeneration,
        summary,
      };
      return jsonOk(payload);
    });

    // 9. GET /api/unified-memory/codex/browse
    mount(API_PATHS.CODEX_BROWSE, ['GET'], async (request) => {
      const url = new URL(request.url);
      const rawGen = url.searchParams.get('generation');
      const gen = rawGen === 'v2' || rawGen === 'v1' ? rawGen : 'auto';
      const status = getCodexMemoryStatus(runtime.codexHome);
      const selectedGeneration: 'v2' | 'v1' =
        gen !== 'auto'
          ? gen
          : status.activeGeneration === 'none'
            ? 'v2'
            : status.activeGeneration;
      const summary = readCodexSummary({
        codexHome: runtime.codexHome,
        generation: selectedGeneration,
        maxBytes: 32 * 1024,
      });
      const files = listCodexFiles(selectedGeneration, runtime.codexHome);
      const payload: CodexBrowseResponse = {
        readOnly: true,
        status,
        selectedGeneration,
        summary,
        files,
      };
      return jsonOk(payload);
    });

    // 10. POST /api/unified-memory/codex/search
    mount(API_PATHS.CODEX_SEARCH, ['POST'], async (request) => {
      const body = await readJsonBody<CodexSearchRequest>(request);
      const query = body.query?.trim() ?? '';
      if (!query) {
        return jsonErr('Field query must be a non-empty string', 400);
      }
      const generation =
        body.generation === 'v2' || body.generation === 'v1' || body.generation === 'both'
          ? body.generation
          : 'auto';
      const limit =
        typeof body.limit === 'number' ? Math.max(1, Math.min(50, Math.trunc(body.limit))) : 25;
      const hits = searchCodexMemories(query, {
        codexHome: runtime.codexHome,
        projectHint: body.projectHint?.trim() || undefined,
        generation,
        limit,
      });
      const payload: CodexSearchResponse = {
        readOnly: true,
        query,
        projectHint: body.projectHint?.trim() || null,
        hits,
      };
      return jsonOk(payload);
    });

    // 11. GET /api/unified-memory/codex/read
    mount(API_PATHS.CODEX_READ, ['GET'], async (request) => {
      const url = new URL(request.url);
      const generation = url.searchParams.get('generation');
      const relativePath = url.searchParams.get('relativePath')?.trim() ?? '';
      if (generation !== 'v2' && generation !== 'v1') {
        return jsonErr('Query param generation must be "v2" or "v1"', 400);
      }
      if (!relativePath) {
        return jsonErr('Missing required query param: relativePath', 400);
      }
      const maxBytes = parseOptionalInt(url.searchParams.get('maxBytes'), 512, 131072, 64 * 1024);
      try {
        const result = readCodexMemoryFile(generation, relativePath, runtime.codexHome, maxBytes);
        const payload: CodexReadResponse = {
          readOnly: true,
          generation: result.generation,
          relativePath: result.relativePath,
          filePath: result.filePath,
          exists: true,
          content: result.content,
          sizeBytes: result.totalBytes,
          truncated: result.truncated,
          mtimeMs: result.mtimeMs,
        };
        return jsonOk(payload);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = /not found/i.test(message) ? 404 : 400;
        return jsonErr(message, status);
      }
    });

    // 12. GET /api/unified-memory/rules/inspect
    mount(API_PATHS.RULES_INSPECT, ['GET'], async (request) => {
      const url = new URL(request.url);
      const workspaceParam = url.searchParams.get('workspacePath')?.trim() ?? '';
      const sessionIdParam = url.searchParams.get('sessionId')?.trim() ?? '';
      const cfg = runtime.getEffectiveConfig();

      // Match live session for exact host-deduped path set
      const matchedLive = sessionIdParam
        ? runtime.liveSessions.get(sessionIdParam)
        : workspaceParam
          ? Array.from(runtime.liveSessions.values()).find(
              (s) => s.cwd && path.resolve(s.cwd) === path.resolve(workspaceParam),
            )
          : runtime.liveSessions.values().next().value;

      const resolvedWs = workspaceParam
        ? path.resolve(workspaceParam)
        : (matchedLive?.cwd ?? null);
      const hostLoadedPaths = matchedLive?.hostLoadedPaths ?? [];
      const hostLoadedSet = new Set(hostLoadedPaths);

      const loaded = loadClaudeRulesForWorkspaces(resolvedWs ? [resolvedWs] : [], {
        claudeConfigDir: runtime.claudeConfigDir,
        homeDir: runtime.homeDir,
        deduplicateNativeAgentsMd: cfg.deduplicateNativeAgentsMd,
        nativeRuleFilenames: DEFAULT_NATIVE_RULE_FILENAMES,
        hostName: DEFAULT_HOST_NAME,
        alreadyLoadedPaths: hostLoadedSet,
        trustClaudeCodeExternalApprovals: cfg.trustClaudeCodeExternalApprovals,
        externalRuleTrust: cfg.externalRuleTrust,
      });

      const sessions = listRecentSessions(runtime.dataDir, 15);
      const payload: RulesInspectResponse = {
        workspacePath: resolvedWs,
        globalAlwaysOn: loaded.globalAlwaysOn,
        globalConditional: loaded.globalConditional,
        workspace: loaded.workspaces[0] ?? null,
        hostLoadedPaths,
        workspaceExternalTrust: resolvedWs
          ? getWorkspaceExternalTrust(cfg.externalRuleTrust, resolvedWs)
          : { allowPaths: [], denyPaths: [] },
        trustClaudeCodeExternalApprovals: cfg.trustClaudeCodeExternalApprovals,
        recentSessionHits: sessions
          .filter(
            (s) =>
              s.loadedRuleKeys.length > 0 ||
              s.loadedSubdirPaths.length > 0 ||
              (s.hostDedupedPaths?.length ?? 0) > 0,
          )
          .map((s) => ({
            conversationId: s.conversationId,
            updatedAt: s.updatedAt,
            loadedRuleKeys: s.loadedRuleKeys,
            loadedSubdirPaths: s.loadedSubdirPaths,
            compactionCount: s.compactionCount,
            hostDedupedPaths: s.hostDedupedPaths ?? [],
          })),
      };
      return jsonOk(payload);
    });

    // 13. POST /api/unified-memory/config/update
    mount(API_PATHS.CONFIG_UPDATE, ['POST'], async (request) => {
      const body = await readJsonBody<ConfigUpdateRequest>(request);
      const patch: Partial<ReturnType<HostRuntime['getEffectiveConfig']>> = {};

      if (body.locale !== undefined) {
        patch.locale = normalizeLocalePreference(body.locale);
      }
      if (typeof body.injectCodexSummaryOnStart === 'boolean') {
        patch.injectCodexSummaryOnStart = body.injectCodexSummaryOnStart;
      }
      if (
        typeof body.codexSummaryMaxBytes === 'number' &&
        Number.isFinite(body.codexSummaryMaxBytes)
      ) {
        patch.codexSummaryMaxBytes = Math.max(512, Math.min(65536, Math.trunc(body.codexSummaryMaxBytes)));
      }
      if (typeof body.injectCodexGlobalAgentsMd === 'boolean') {
        patch.injectCodexGlobalAgentsMd = body.injectCodexGlobalAgentsMd;
      }
      if (typeof body.deduplicateNativeAgentsMd === 'boolean') {
        patch.deduplicateNativeAgentsMd = body.deduplicateNativeAgentsMd;
      }
      if (
        typeof body.maxStartupInjectBytes === 'number' &&
        Number.isFinite(body.maxStartupInjectBytes)
      ) {
        patch.maxStartupInjectBytes = Math.max(
          4096,
          Math.min(262144, Math.trunc(body.maxStartupInjectBytes)),
        );
      }
      if (typeof body.trustClaudeCodeExternalApprovals === 'boolean') {
        patch.trustClaudeCodeExternalApprovals = body.trustClaudeCodeExternalApprovals;
      }

      const updated = runtime.updatePersistedConfig(patch);
      const payload: ConfigUpdateResponse = {
        config: updated,
        resolvedLocale: runtime.resolveEffectiveLocale(updated.locale),
      };
      return jsonOk(payload);
    });

    // 14. POST /api/unified-memory/trust/update (Owner-only UI boundary; never exposed as a model tool)
    mount(API_PATHS.TRUST_UPDATE, ['POST'], async (request) => {
      const body = await readJsonBody<TrustUpdateRequest>(request);
      if (!body.workspacePath?.trim()) {
        return jsonErr('Field workspacePath is required', 400);
      }
      const validActions = ['allow', 'deny', 'revoke', 'clear_workspace'] as const;
      if (!validActions.includes(body.action)) {
        return jsonErr(`Invalid trust action: ${String(body.action)}`, 400);
      }
      const res = updateWorkspaceExternalTrust(
        body.workspacePath.trim(),
        body.action,
        body.targetPath,
        runtime.dataDir,
      );
      const payload: TrustUpdateResponse = {
        workspaceKey: res.workspaceKey,
        trust: res.trust,
        trustClaudeCodeExternalApprovals: res.config.trustClaudeCodeExternalApprovals,
      };
      return jsonOk(payload);
    });

    // 15. POST /api/unified-memory/diagnostics/clear
    mount(API_PATHS.DIAGNOSTICS_CLEAR, ['POST'], async () => {
      clearDiagnosticEvents(runtime.dataDir);
      const payload: DiagnosticsClearResponse = { cleared: true };
      return jsonOk(payload);
    });

    // 16. GET /api/unified-memory/session/context (Right Sidebar Per-Session Tab)
    mount(API_PATHS.SESSION_CONTEXT, ['GET'], async (request) => {
      const url = new URL(request.url);
      const requestedId = url.searchParams.get('sessionId')?.trim() ?? '';
      const activeSessions = runtime.listLiveSessionSummaries();

      let snapshot = requestedId ? (runtime.liveSessions.get(requestedId) ?? null) : null;
      if (!snapshot && !requestedId && activeSessions.length > 0) {
        snapshot = runtime.liveSessions.get(activeSessions[0].sessionId) ?? null;
      }

      // If requested session is live in `ctx.agents` but hasn't run its first pre-step yet, synthesize a pending snapshot
      if (!snapshot && requestedId) {
        const liveAgent = ctx.agents.list().find((a) => String(a.id) === requestedId);
        if (liveAgent) {
          const cwd = await runtime.resolveAgentCwd(liveAgent);
          const resolution = cwd
            ? resolveClaudeProject(cwd, {
                claudeConfigDir: runtime.claudeConfigDir,
                env: runtime.env,
              })
            : null;
          const memIndex =
            resolution && resolution.autoMemoryEnabled
              ? readMemoryIndex(resolution.memoryDir)
              : null;
          const topics =
            resolution && resolution.autoMemoryEnabled
              ? listTopicMemories(resolution.memoryDir)
              : [];
          snapshot = {
            sessionId: requestedId,
            cwd,
            resolvedProjectRoot: resolution?.resolvedRoot ?? null,
            claudeSlug: resolution?.slug ?? null,
            resolvedLocale: runtime.resolveEffectiveLocale(),
            origin: liveAgent.session.header.origin === 'subagent' ? 'subagent' : 'root',
            isSeeded: Boolean(liveAgent.session.header.isSeeded),
            baselineInjected: false,
            baselineInjectedAt: null,
            baselineBytes: 0,
            replaceGeneration: liveAgent.session.surface.replaceGeneration,
            compactionCount: 0,
            hostAgentInstructionsActive: false,
            hostLoadedPaths: [],
            injectedLabels: [],
            loadedAlwaysOnRules: [],
            indexedConditionalRules: [],
            loadedSubdirClaudeMds: [],
            pendingExternalApprovalCount: 0,
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
            codexSummaryInjected: false,
            updatedAt: new Date().toISOString(),
          };
        }
      }

      const payload: SessionContextResponse = {
        session: snapshot,
        activeSessions,
      };
      return jsonOk(payload);
    });
  });
}
