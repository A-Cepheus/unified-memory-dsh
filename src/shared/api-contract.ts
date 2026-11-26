import type {
  ClaudeMemoryIndex,
  ClaudeMemoryTopic,
  ClaudeMemoryType,
  ClaudeProjectResolution,
  ClaudeProjectSummary,
  ClaudeRuleEntry,
  ClaudeRuleScope,
  CodexMemoryStatus,
  CodexSearchHit,
  DiagnosticEvent,
  LocalePreference,
  ResolvedLocale,
  UnifiedMemoryConfig,
  WorkspaceExternalTrustConfig,
  WorkspaceRulesBundle,
} from '../core/types.js';

export type {
  ClaudeMemoryIndex,
  ClaudeMemoryTopic,
  ClaudeMemoryType,
  ClaudeProjectResolution,
  ClaudeProjectSummary,
  ClaudeRuleEntry,
  ClaudeRuleScope,
  CodexMemoryStatus,
  CodexSearchHit,
  DiagnosticEvent,
  LocalePreference,
  ResolvedLocale,
  UnifiedMemoryConfig,
  WorkspaceExternalTrustConfig,
  WorkspaceRulesBundle,
};

export const PLUGIN_ID = 'unified-memory-dsh';
export const PLUGIN_VERSION = '0.1.1';

/**
 * Absolute paths registered on the Host via `ctx.connection.fetch.register`.
 * All endpoints strictly use `GET` or `POST` (DSH ConnectionFetchMethod allows
 * only `GET | HEAD | POST`).
 */
export const API_PATHS = {
  OVERVIEW: '/api/unified-memory/overview',
  CLAUDE_RESOLVE: '/api/unified-memory/claude/resolve',
  CLAUDE_LIST: '/api/unified-memory/claude/list',
  CLAUDE_READ: '/api/unified-memory/claude/read',
  CLAUDE_SAVE: '/api/unified-memory/claude/save',
  CLAUDE_DELETE: '/api/unified-memory/claude/delete',
  CLAUDE_SAVE_INDEX: '/api/unified-memory/claude/save-index',
  CODEX_SUMMARY: '/api/unified-memory/codex/summary',
  CODEX_BROWSE: '/api/unified-memory/codex/browse',
  CODEX_SEARCH: '/api/unified-memory/codex/search',
  CODEX_READ: '/api/unified-memory/codex/read',
  RULES_INSPECT: '/api/unified-memory/rules/inspect',
  CONFIG_UPDATE: '/api/unified-memory/config/update',
  TRUST_UPDATE: '/api/unified-memory/trust/update',
  DIAGNOSTICS_CLEAR: '/api/unified-memory/diagnostics/clear',
  SESSION_CONTEXT: '/api/unified-memory/session/context',
} as const;

/**
 * Document-relative URLs used by the browser Client plugin (`fetch(API_ROUTES.OVERVIEW)`),
 * without leading slash so reverse-proxy base paths resolve cleanly.
 */
export const API_ROUTES = {
  OVERVIEW: API_PATHS.OVERVIEW.slice(1),
  CLAUDE_RESOLVE: API_PATHS.CLAUDE_RESOLVE.slice(1),
  CLAUDE_LIST: API_PATHS.CLAUDE_LIST.slice(1),
  CLAUDE_READ: API_PATHS.CLAUDE_READ.slice(1),
  CLAUDE_SAVE: API_PATHS.CLAUDE_SAVE.slice(1),
  CLAUDE_DELETE: API_PATHS.CLAUDE_DELETE.slice(1),
  CLAUDE_SAVE_INDEX: API_PATHS.CLAUDE_SAVE_INDEX.slice(1),
  CODEX_SUMMARY: API_PATHS.CODEX_SUMMARY.slice(1),
  CODEX_BROWSE: API_PATHS.CODEX_BROWSE.slice(1),
  CODEX_SEARCH: API_PATHS.CODEX_SEARCH.slice(1),
  CODEX_READ: API_PATHS.CODEX_READ.slice(1),
  RULES_INSPECT: API_PATHS.RULES_INSPECT.slice(1),
  CONFIG_UPDATE: API_PATHS.CONFIG_UPDATE.slice(1),
  TRUST_UPDATE: API_PATHS.TRUST_UPDATE.slice(1),
  DIAGNOSTICS_CLEAR: API_PATHS.DIAGNOSTICS_CLEAR.slice(1),
  SESSION_CONTEXT: API_PATHS.SESSION_CONTEXT.slice(1),
} as const;

export interface ApiErrorResponse {
  error: string;
  code?: string;
}

export interface LiveSessionSummary {
  sessionId: string;
  cwd: string | null;
  resolvedProjectRoot: string | null;
  claudeSlug: string | null;
  resolvedLocale: ResolvedLocale;
  origin: 'root' | 'subagent';
  isSeeded: boolean;
  baselineInjected: boolean;
  compactionCount: number;
  hostDedupedCount: number;
  loadedRuleCount: number;
  loadedSubdirCount: number;
  updatedAt: string;
}

export interface RecentSessionSummary {
  conversationId: string;
  startedAt: string;
  updatedAt: string;
  workspacePaths: string[];
  locale?: ResolvedLocale;
  loadedRuleCount: number;
  loadedSubdirCount: number;
  indexedConditionalCount: number;
  compactionCount: number;
  hostDedupedCount: number;
}

export interface OverviewResponse {
  version: string;
  pluginDataDir: string;
  resolvedLocale: ResolvedLocale;
  hostLocalePreference: string | null;
  claude: {
    configDir: string;
    exists: boolean;
    hasGlobalClaudeMd: boolean;
    hasGlobalRulesDir: boolean;
    projectCount: number;
    totalTopics: number;
    projects: ClaudeProjectSummary[];
  };
  codex: CodexMemoryStatus;
  activeSessions: LiveSessionSummary[];
  recentSessions: RecentSessionSummary[];
  diagnostics: DiagnosticEvent[];
  config: UnifiedMemoryConfig;
  workspaceHints: string[];
}

export interface ClaudeListResponse {
  slug: string;
  resolvedRoot: string | null;
  memoryDir: string;
  autoMemoryEnabled: boolean;
  index: ClaudeMemoryIndex;
  topics: ClaudeMemoryTopic[];
}

export type ClaudeReadResponse =
  | { kind: 'index'; slug: string; memoryDir: string; index: ClaudeMemoryIndex }
  | { kind: 'topic'; slug: string; memoryDir: string; topic: ClaudeMemoryTopic };

export interface ClaudeSaveRequest {
  projectPath?: string;
  slug?: string;
  filename?: string;
  name: string;
  description: string;
  type: ClaudeMemoryType;
  body: string;
  originSessionId?: string;
}

export interface ClaudeSaveResponse {
  slug: string;
  topic: ClaudeMemoryTopic;
  index: ClaudeMemoryIndex;
  warnings: string[];
}

export interface ClaudeDeleteRequest {
  projectPath?: string;
  slug?: string;
  filename: string;
}

export interface ClaudeDeleteResponse {
  slug: string;
  deleted: boolean;
  index: ClaudeMemoryIndex;
}

export interface ClaudeSaveIndexRequest {
  projectPath?: string;
  slug?: string;
  content: string;
}

export interface ClaudeSaveIndexResponse {
  slug: string;
  index: ClaudeMemoryIndex;
}

export interface CodexSummaryResult {
  generation: 'v2' | 'v1' | 'none';
  filePath?: string;
  content: string;
  truncated: boolean;
  totalBytes: number;
  mtimeMs: number;
}

export interface CodexSummaryResponse {
  readOnly: true;
  status: CodexMemoryStatus;
  selectedGeneration: 'v2' | 'v1';
  summary: CodexSummaryResult;
}

export interface CodexFileItem {
  category: CodexSearchHit['category'];
  relativePath: string;
  title: string;
  sizeBytes: number;
  mtimeMs: number;
}

export interface CodexBrowseResponse {
  readOnly: true;
  status: CodexMemoryStatus;
  selectedGeneration: 'v2' | 'v1';
  summary: CodexSummaryResult;
  files: CodexFileItem[];
}

export interface CodexSearchRequest {
  query: string;
  projectHint?: string;
  generation?: 'auto' | 'v2' | 'v1' | 'both';
  limit?: number;
}

export interface CodexSearchResponse {
  readOnly: true;
  query: string;
  projectHint: string | null;
  hits: CodexSearchHit[];
}

export interface CodexReadResponse {
  readOnly: true;
  generation: 'v2' | 'v1';
  relativePath: string;
  filePath: string;
  exists: boolean;
  content: string;
  sizeBytes: number;
  truncated: boolean;
  mtimeMs: number;
}

export interface RecentSessionRuleHit {
  conversationId: string;
  updatedAt: string;
  loadedRuleKeys: string[];
  loadedSubdirPaths: string[];
  compactionCount: number;
  hostDedupedPaths: string[];
}

export interface RulesInspectResponse {
  workspacePath: string | null;
  globalAlwaysOn: ClaudeRuleEntry[];
  globalConditional: ClaudeRuleEntry[];
  workspace: WorkspaceRulesBundle | null;
  hostLoadedPaths: string[];
  workspaceExternalTrust: WorkspaceExternalTrustConfig;
  trustClaudeCodeExternalApprovals: boolean;
  recentSessionHits: RecentSessionRuleHit[];
}

export interface ConfigUpdateRequest {
  locale?: LocalePreference | 'zh-CN';
  injectCodexSummaryOnStart?: boolean;
  codexSummaryMaxBytes?: number;
  injectCodexGlobalAgentsMd?: boolean;
  deduplicateNativeAgentsMd?: boolean;
  maxStartupInjectBytes?: number;
  trustClaudeCodeExternalApprovals?: boolean;
}

export interface ConfigUpdateResponse {
  config: UnifiedMemoryConfig;
  resolvedLocale: ResolvedLocale;
}

export interface TrustUpdateRequest {
  workspacePath: string;
  action: 'allow' | 'deny' | 'revoke' | 'clear_workspace';
  targetPath?: string;
}

export interface TrustUpdateResponse {
  workspaceKey: string;
  trust: WorkspaceExternalTrustConfig;
  trustClaudeCodeExternalApprovals: boolean;
}

export interface DiagnosticsClearResponse {
  cleared: true;
}

export interface LiveSessionRuleItem {
  displayPath: string;
  filePath: string;
  scope: ClaudeRuleScope;
  dedupedByHost: boolean;
  importsCount: number;
}

export interface LiveSessionConditionalRuleItem {
  id: string;
  displayPath: string;
  filePath: string;
  paths: string[];
  scope: ClaudeRuleScope;
  loaded: boolean;
  triggeredBy?: string;
}

export interface LiveSessionSubdirRuleItem {
  displayPath: string;
  filePath: string;
  triggeredBy: string;
}

export interface LiveSessionContextSnapshot {
  sessionId: string;
  cwd: string | null;
  resolvedProjectRoot: string | null;
  claudeSlug: string | null;
  resolvedLocale: ResolvedLocale;
  origin: 'root' | 'subagent';
  isSeeded: boolean;
  baselineInjected: boolean;
  baselineInjectedAt: string | null;
  baselineBytes: number;
  replaceGeneration: number;
  compactionCount: number;
  hostAgentInstructionsActive: boolean;
  hostLoadedPaths: string[];
  injectedLabels: string[];
  loadedAlwaysOnRules: LiveSessionRuleItem[];
  indexedConditionalRules: LiveSessionConditionalRuleItem[];
  loadedSubdirClaudeMds: LiveSessionSubdirRuleItem[];
  pendingExternalApprovalCount: number;
  claudeMemoryIndex: {
    exists: boolean;
    totalLines: number;
    maxLines: number;
    totalBytes: number;
    maxBytes: number;
    truncated: boolean;
    topicCount: number;
  } | null;
  codexSummaryInjected: boolean;
  updatedAt: string;
}

export interface SessionContextResponse {
  session: LiveSessionContextSnapshot | null;
  activeSessions: LiveSessionSummary[];
}
