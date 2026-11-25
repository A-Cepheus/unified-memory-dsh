import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import type {} from '@deepseek-ai/dsh-settings';
import type {} from '@deepseek-ai/dsh-working-directory';
import {
  DEFAULT_CONFIG,
  getClaudeConfigDir,
  getCodexHome,
  loadPluginConfig,
  normalizeLocalePreference,
  resolveLocale,
  resolvePluginDataDir,
  savePluginConfig,
  type LocalePreference,
  type ResolvedLocale,
  type UnifiedMemoryConfig,
} from '../core/index.js';
import type {
  LiveSessionContextSnapshot,
  LiveSessionSummary,
} from '../shared/api-contract.js';

/**
 * Raw Cordis plugin configuration object (volatile fields arrive wrapped in
 * Cosmokit `Volatile<T>` holders at runtime, or plain values in unit tests).
 */
export interface HostPluginConfig {
  locale?: LocalePreference | { get(): LocalePreference | undefined };
  injectCodexSummaryOnStart?: boolean | { get(): boolean | undefined };
  codexSummaryMaxBytes?: number | { get(): number | undefined };
  injectCodexGlobalAgentsMd?: boolean | { get(): boolean | undefined };
  deduplicateNativeAgentsMd?: boolean | { get(): boolean | undefined };
  maxStartupInjectBytes?: number | { get(): number | undefined };
  trustClaudeCodeExternalApprovals?: boolean | { get(): boolean | undefined };
  dataDir?: string;
}

export function unwrapVolatile<T>(value: T | { get(): T } | undefined): T | undefined {
  if (
    value !== null &&
    typeof value === 'object' &&
    'get' in value &&
    typeof (value as { get?: unknown }).get === 'function'
  ) {
    return (value as { get(): T }).get();
  }
  return value as T | undefined;
}

export interface HostRuntime {
  readonly ctx: Context;
  readonly env: NodeJS.ProcessEnv;
  readonly homeDir: string;
  readonly dataDir: string;
  readonly claudeConfigDir: string;
  readonly codexHome: string;
  /** Returns merged effective config (persisted config.json + Cordis defaults). */
  getEffectiveConfig(): UnifiedMemoryConfig;
  /** Updates persisted config.json (called by Web UI / HTTP API / slash commands). */
  updatePersistedConfig(patch: Partial<UnifiedMemoryConfig>): UnifiedMemoryConfig;
  /** Reads DSH host UI locale preference from `ctx.settings` (ns === 'locale'). */
  getHostLocalePreference(): string | null;
  /** Resolves effective `'zh' | 'en'` locale according to full DSH precedence chain. */
  resolveEffectiveLocale(overridePref?: LocalePreference): ResolvedLocale;
  /** Tracks live per-session snapshot for Right Sidebar & `/memory status`. */
  readonly liveSessions: Map<string, LiveSessionContextSnapshot>;
  /** Session IDs flagged by `/memory reload` to force baseline re-injection on next pre-step. */
  readonly pendingReloadSessions: Set<string>;
  getLiveSessionSummary(snapshot: LiveSessionContextSnapshot): LiveSessionSummary;
  listLiveSessionSummaries(): LiveSessionSummary[];
  /** Best-effort resolution of cwd for an agent or explicit override. */
  resolveAgentCwd(agent: Agent | undefined, signal?: AbortSignal): Promise<string | null>;
}

function readCordisOverrides(rawConfig: HostPluginConfig | undefined): Partial<UnifiedMemoryConfig> {
  if (!rawConfig) return {};
  const out: Partial<UnifiedMemoryConfig> = {};

  const locale = unwrapVolatile(rawConfig.locale);
  if (locale !== undefined) out.locale = normalizeLocalePreference(locale);

  const injectCodexSummaryOnStart = unwrapVolatile(rawConfig.injectCodexSummaryOnStart);
  if (typeof injectCodexSummaryOnStart === 'boolean') {
    out.injectCodexSummaryOnStart = injectCodexSummaryOnStart;
  }

  const codexSummaryMaxBytes = unwrapVolatile(rawConfig.codexSummaryMaxBytes);
  if (typeof codexSummaryMaxBytes === 'number' && codexSummaryMaxBytes >= 512) {
    out.codexSummaryMaxBytes = codexSummaryMaxBytes;
  }

  const injectCodexGlobalAgentsMd = unwrapVolatile(rawConfig.injectCodexGlobalAgentsMd);
  if (typeof injectCodexGlobalAgentsMd === 'boolean') {
    out.injectCodexGlobalAgentsMd = injectCodexGlobalAgentsMd;
  }

  const deduplicateNativeAgentsMd = unwrapVolatile(rawConfig.deduplicateNativeAgentsMd);
  if (typeof deduplicateNativeAgentsMd === 'boolean') {
    out.deduplicateNativeAgentsMd = deduplicateNativeAgentsMd;
  }

  const maxStartupInjectBytes = unwrapVolatile(rawConfig.maxStartupInjectBytes);
  if (typeof maxStartupInjectBytes === 'number' && maxStartupInjectBytes >= 4096) {
    out.maxStartupInjectBytes = maxStartupInjectBytes;
  }

  const trustClaudeCodeExternalApprovals = unwrapVolatile(
    rawConfig.trustClaudeCodeExternalApprovals,
  );
  if (typeof trustClaudeCodeExternalApprovals === 'boolean') {
    out.trustClaudeCodeExternalApprovals = trustClaudeCodeExternalApprovals;
  }

  return out;
}

export function createHostRuntime(
  ctx: Context,
  rawConfig?: HostPluginConfig,
  env: NodeJS.ProcessEnv = process.env,
): HostRuntime {
  const homeDir = os.homedir();

  // Precedence for data dir: explicit config.dataDir -> env overrides -> dshHomePath('storages', 'unified-memory')
  const envOverride = env.UNIFIED_MEMORY_DATA_DIR?.trim() || env.PLUGIN_DATA?.trim();
  const explicitDataDir =
    rawConfig?.dataDir?.trim() ||
    (envOverride ? undefined : dshHomePath('storages', 'unified-memory'));
  const dataDir = resolvePluginDataDir(env, explicitDataDir);
  const claudeConfigDir = getClaudeConfigDir(env);
  const codexHome = getCodexHome(env);
  const liveSessions = new Map<string, LiveSessionContextSnapshot>();
  const pendingReloadSessions = new Set<string>();

  const getEffectiveConfig = (): UnifiedMemoryConfig => {
    const cfgPath = path.join(dataDir, 'config.json');
    const cordisOverrides = readCordisOverrides(rawConfig);
    if (!fs.existsSync(cfgPath)) {
      return {
        ...DEFAULT_CONFIG,
        ...cordisOverrides,
        externalRuleTrust: {},
      };
    }
    // Persisted config.json (updated by Web UI / trust manager) takes precedence
    // over initial cordis.patch.yml defaults, while Cordis volatile edits still
    // work when config.json hasn't overridden them or when synced.
    const persisted = loadPluginConfig(dataDir);
    return {
      ...DEFAULT_CONFIG,
      ...cordisOverrides,
      ...persisted,
    };
  };

  const updatePersistedConfig = (patch: Partial<UnifiedMemoryConfig>): UnifiedMemoryConfig => {
    // Seed config.json from current effective config so Cordis defaults aren't lost on first write
    const base = getEffectiveConfig();
    return savePluginConfig({ ...base, ...patch }, dataDir);
  };

  const getHostLocalePreference = (): string | null => {
    try {
      const settings = ctx.get('settings');
      if (!settings) return null;
      const descriptors = settings.describe();
      const localeDesc = descriptors.find((d) => String(d.ns) === 'locale');
      const val = localeDesc?.value;
      if (val && typeof val === 'object' && 'preference' in val) {
        const pref = (val as { preference?: unknown }).preference;
        if (typeof pref === 'string' && pref.trim().length > 0) {
          return pref.trim();
        }
      }
    } catch {
      // Optional service — never break runtime if settings is unavailable or unloading
    }
    return null;
  };

  const resolveEffectiveLocale = (overridePref?: LocalePreference): ResolvedLocale => {
    const cfg = getEffectiveConfig();
    return resolveLocale({
      configLocale: overridePref ?? cfg.locale,
      env,
      hostLocale: getHostLocalePreference(),
    });
  };

  const getLiveSessionSummary = (snapshot: LiveSessionContextSnapshot): LiveSessionSummary => ({
    sessionId: snapshot.sessionId,
    cwd: snapshot.cwd,
    resolvedProjectRoot: snapshot.resolvedProjectRoot,
    claudeSlug: snapshot.claudeSlug,
    resolvedLocale: snapshot.resolvedLocale,
    origin: snapshot.origin,
    isSeeded: snapshot.isSeeded,
    baselineInjected: snapshot.baselineInjected,
    compactionCount: snapshot.compactionCount,
    hostDedupedCount: snapshot.hostLoadedPaths.length,
    loadedRuleCount: snapshot.indexedConditionalRules.filter((r) => r.loaded).length,
    loadedSubdirCount: snapshot.loadedSubdirClaudeMds.length,
    updatedAt: snapshot.updatedAt,
  });

  const listLiveSessionSummaries = (): LiveSessionSummary[] =>
    Array.from(liveSessions.values())
      .map(getLiveSessionSummary)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));

  const resolveAgentCwd = async (
    agent: Agent | undefined,
    signal?: AbortSignal,
  ): Promise<string | null> => {
    if (!agent) return null;
    try {
      const cwd = await ctx.workingDirectory.ensure(agent, signal);
      return cwd ? path.resolve(cwd) : null;
    } catch {
      const headerCwd = agent.session?.header?.cwd;
      return typeof headerCwd === 'string' && headerCwd.trim()
        ? path.resolve(headerCwd.trim())
        : null;
    }
  };

  // Clean up disposed agents from live session map while preserving on-disk session history
  ctx.on('agent/disposed', ({ agent }) => {
    const id = String(agent.id);
    liveSessions.delete(id);
    pendingReloadSessions.delete(id);
  });

  return {
    ctx,
    env,
    homeDir,
    dataDir,
    claudeConfigDir,
    codexHome,
    getEffectiveConfig,
    updatePersistedConfig,
    getHostLocalePreference,
    resolveEffectiveLocale,
    liveSessions,
    pendingReloadSessions,
    getLiveSessionSummary,
    listLiveSessionSummaries,
    resolveAgentCwd,
  };
}
