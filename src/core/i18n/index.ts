import {
  CORE_MESSAGES,
  type CoreMessageCatalog,
  type LocalePreference,
  type ResolvedLocale,
} from './messages.js';

export { CORE_MESSAGES, type CoreMessageCatalog, type LocalePreference, type ResolvedLocale };

/**
 * Normalizes any BCP-47 / POSIX locale tag to DSH's canonical `'zh' | 'en'`.
 * Returns `null` when empty, `'auto'`, `'c'`, `'posix'`, or unrecognized.
 */
export function normalizeLocale(raw: unknown): ResolvedLocale | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().split('.')[0]?.split('@')[0]?.trim().toLowerCase() ?? '';
  if (!cleaned || cleaned === 'auto' || cleaned === 'c' || cleaned === 'posix') {
    return null;
  }
  if (cleaned === 'zh' || cleaned.startsWith('zh-') || cleaned.startsWith('zh_')) {
    return 'zh';
  }
  if (cleaned === 'en' || cleaned.startsWith('en-') || cleaned.startsWith('en_')) {
    return 'en';
  }
  return null;
}

/**
 * Normalizes a persisted or user-supplied locale preference (`'auto' | 'zh' | 'en'`).
 * Accepts `'zh-CN'` / `'zh-Hans'` / `'zh_CN'` aliases and normalizes them to `'zh'`.
 */
export function normalizeLocalePreference(raw: unknown): LocalePreference {
  if (typeof raw !== 'string') return 'auto';
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === 'auto') return 'auto';
  return normalizeLocale(trimmed) ?? 'auto';
}

export interface ResolveLocaleOptions {
  /** Plugin config preference (`config.locale`, highest priority when not `'auto'`). */
  configLocale?: LocalePreference | string | null;
  /** Process environment (checks `UNIFIED_MEMORY_LOCALE`, `LC_ALL`, `LC_MESSAGES`, `LANG`). */
  env?: NodeJS.ProcessEnv;
  /** Host UI/runtime locale preference (e.g. DSH `settings` `'locale'` namespace `preference`). */
  hostLocale?: string | null;
  /** Optional explicit system locale override (for deterministic testing). */
  systemLocale?: string | null;
}

/**
 * Deterministic locale resolution chain aligned with DeepSeek Harness (`'zh' | 'en'`):
 * 1. Explicit plugin config (`configLocale !== 'auto'`)
 * 2. Environment override (`UNIFIED_MEMORY_LOCALE`)
 * 3. Host locale preference (DSH `ctx.settings` `'locale'` namespace)
 * 4. POSIX locale env vars (`LC_ALL` -> `LC_MESSAGES` -> `LANG`)
 * 5. Runtime `Intl.DateTimeFormat().resolvedOptions().locale`
 * 6. Fallback `'en'`
 */
export function resolveLocale(options?: ResolveLocaleOptions): ResolvedLocale {
  const env = options?.env ?? process.env;

  const fromConfig = normalizeLocale(options?.configLocale);
  if (fromConfig) return fromConfig;

  const fromPluginEnv = normalizeLocale(env.UNIFIED_MEMORY_LOCALE);
  if (fromPluginEnv) return fromPluginEnv;

  const fromHost = normalizeLocale(options?.hostLocale);
  if (fromHost) return fromHost;

  for (const key of ['LC_ALL', 'LC_MESSAGES', 'LANG'] as const) {
    const val = normalizeLocale(env[key]);
    if (val) return val;
  }

  let runtimeLocale = options?.systemLocale;
  if (runtimeLocale === undefined) {
    try {
      runtimeLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      runtimeLocale = null;
    }
  }
  const fromSystem = normalizeLocale(runtimeLocale);
  if (fromSystem) return fromSystem;

  return 'en';
}

export function getMessages(locale: ResolvedLocale): CoreMessageCatalog {
  return CORE_MESSAGES[locale] ?? CORE_MESSAGES.en;
}
