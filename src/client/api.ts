import {
  API_ROUTES,
  type ApiErrorResponse,
  type ClaudeDeleteRequest,
  type ClaudeDeleteResponse,
  type ClaudeListResponse,
  type ClaudeProjectResolution,
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

export class UnifiedMemoryApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'UnifiedMemoryApiError';
    this.status = status;
    this.code = code;
  }
}

function buildRelativeUrl(
  route: string,
  query?: Record<string, string | number | undefined | null>,
): string {
  // Always keep paths strictly document-relative (no leading slash) for reverse-proxy safety.
  const normalized = route.replace(/^\/+/, '');
  if (!query) return normalized;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && String(v).length > 0) {
      params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return qs ? `${normalized}?${qs}` : normalized;
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      if (!res.ok) {
        throw new UnifiedMemoryApiError(
          `HTTP ${res.status}: ${text.slice(0, 240)}`,
          res.status,
        );
      }
      throw new UnifiedMemoryApiError('Invalid JSON response from Unified Memory host', res.status);
    }
  }
  if (!res.ok) {
    const errObj = parsed as Partial<ApiErrorResponse> | null;
    const msg =
      typeof errObj?.error === 'string' && errObj.error.length > 0
        ? errObj.error
        : `HTTP ${res.status}`;
    throw new UnifiedMemoryApiError(msg, res.status, errObj?.code);
  }
  return parsed as T;
}

async function apiGet<T>(
  route: string,
  query?: Record<string, string | number | undefined | null>,
  signal?: AbortSignal,
): Promise<T> {
  const url = buildRelativeUrl(route, query);
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal,
  });
  return parseJsonResponse<T>(res);
}

async function apiPost<T>(
  route: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const url = buildRelativeUrl(route);
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
    signal,
  });
  return parseJsonResponse<T>(res);
}

export const unifiedMemoryApi = {
  getOverview(cwd?: string, signal?: AbortSignal): Promise<OverviewResponse> {
    return apiGet<OverviewResponse>(API_ROUTES.OVERVIEW, { cwd }, signal);
  },

  resolveClaudeProject(inputPath: string, signal?: AbortSignal): Promise<ClaudeProjectResolution> {
    return apiGet<ClaudeProjectResolution>(API_ROUTES.CLAUDE_RESOLVE, { path: inputPath }, signal);
  },

  listClaudeMemories(
    params: { projectPath?: string; slug?: string },
    signal?: AbortSignal,
  ): Promise<ClaudeListResponse> {
    return apiGet<ClaudeListResponse>(API_ROUTES.CLAUDE_LIST, params, signal);
  },

  readClaudeMemory(
    params: { projectPath?: string; slug?: string; filename?: string },
    signal?: AbortSignal,
  ): Promise<ClaudeReadResponse> {
    return apiGet<ClaudeReadResponse>(API_ROUTES.CLAUDE_READ, params, signal);
  },

  saveClaudeTopic(body: ClaudeSaveRequest, signal?: AbortSignal): Promise<ClaudeSaveResponse> {
    return apiPost<ClaudeSaveResponse>(API_ROUTES.CLAUDE_SAVE, body, signal);
  },

  deleteClaudeTopic(body: ClaudeDeleteRequest, signal?: AbortSignal): Promise<ClaudeDeleteResponse> {
    return apiPost<ClaudeDeleteResponse>(API_ROUTES.CLAUDE_DELETE, body, signal);
  },

  saveClaudeIndex(
    body: ClaudeSaveIndexRequest,
    signal?: AbortSignal,
  ): Promise<ClaudeSaveIndexResponse> {
    return apiPost<ClaudeSaveIndexResponse>(API_ROUTES.CLAUDE_SAVE_INDEX, body, signal);
  },

  getCodexSummary(
    params?: { generation?: 'auto' | 'v2' | 'v1'; maxBytes?: number },
    signal?: AbortSignal,
  ): Promise<CodexSummaryResponse> {
    return apiGet<CodexSummaryResponse>(API_ROUTES.CODEX_SUMMARY, params, signal);
  },

  browseCodex(
    generation: 'auto' | 'v2' | 'v1' = 'auto',
    signal?: AbortSignal,
  ): Promise<CodexBrowseResponse> {
    return apiGet<CodexBrowseResponse>(API_ROUTES.CODEX_BROWSE, { generation }, signal);
  },

  searchCodex(body: CodexSearchRequest, signal?: AbortSignal): Promise<CodexSearchResponse> {
    return apiPost<CodexSearchResponse>(API_ROUTES.CODEX_SEARCH, body, signal);
  },

  readCodexFile(
    params: { generation: 'v2' | 'v1'; relativePath: string; maxBytes?: number },
    signal?: AbortSignal,
  ): Promise<CodexReadResponse> {
    return apiGet<CodexReadResponse>(API_ROUTES.CODEX_READ, params, signal);
  },

  inspectRules(
    params?: { workspacePath?: string; sessionId?: string },
    signal?: AbortSignal,
  ): Promise<RulesInspectResponse> {
    return apiGet<RulesInspectResponse>(API_ROUTES.RULES_INSPECT, params, signal);
  },

  updateConfig(body: ConfigUpdateRequest, signal?: AbortSignal): Promise<ConfigUpdateResponse> {
    return apiPost<ConfigUpdateResponse>(API_ROUTES.CONFIG_UPDATE, body, signal);
  },

  updateTrust(body: TrustUpdateRequest, signal?: AbortSignal): Promise<TrustUpdateResponse> {
    return apiPost<TrustUpdateResponse>(API_ROUTES.TRUST_UPDATE, body, signal);
  },

  clearDiagnostics(signal?: AbortSignal): Promise<DiagnosticsClearResponse> {
    return apiPost<DiagnosticsClearResponse>(API_ROUTES.DIAGNOSTICS_CLEAR, {}, signal);
  },

  getSessionContext(sessionId?: string, signal?: AbortSignal): Promise<SessionContextResponse> {
    return apiGet<SessionContextResponse>(API_ROUTES.SESSION_CONTEXT, { sessionId }, signal);
  },
};
