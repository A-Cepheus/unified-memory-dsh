import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { PLUGIN_VERSION, type OverviewResponse } from '../../shared/api-contract.js';
import { unifiedMemoryApi } from '../api.js';
import type { MainSlotRuntimeProps } from '../dsh-types.js';
import { createFallbackTranslator } from '../i18n.js';
import { MemoryGlyph, RefreshIcon } from '../icons.js';
import { ClaudeTab } from './ClaudeTab.js';
import { CodexTab } from './CodexTab.js';
import { OverviewTab, type NotifyTone } from './OverviewTab.js';
import { RulesTab } from './RulesTab.js';

export type ConsoleTabId = 'overview' | 'claude' | 'codex' | 'rules';

export function UnifiedMemoryConsole(props: MainSlotRuntimeProps): ReactElement {
  const { t: slotT, useSessions } = props;
  const t = useMemo(() => slotT ?? createFallbackTranslator('en'), [slotT]);

  // Primitive selector keeps useSyncExternalStore snapshots strictly stable.
  const activeSessionEncoded = useSessions
    ? useSessions((state) => {
        const entries = Object.values(state.byId);
        const main = entries.find((s) => s && (s.retainedBy?.mainView ?? 0) > 0);
        const chosen = main ?? entries.find((s) => Boolean(s?.cwd));
        return chosen ? `${chosen.id}\u0000${chosen.cwd ?? ''}` : '';
      })
    : '';

  const [activeSessionId, activeSessionCwd] = useMemo(() => {
    if (!activeSessionEncoded) return [undefined, undefined] as const;
    const sep = activeSessionEncoded.indexOf('\u0000');
    if (sep < 0) return [activeSessionEncoded, undefined] as const;
    const id = activeSessionEncoded.slice(0, sep) || undefined;
    const cwd = activeSessionEncoded.slice(sep + 1) || undefined;
    return [id, cwd] as const;
  }, [activeSessionEncoded]);

  const [tab, setTab] = useState<ConsoleTabId>('overview');
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string>('');
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [selectedRulesSessionId, setSelectedRulesSessionId] = useState<string | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: NotifyTone } | null>(null);

  const notify = useCallback((msg: string, tone: NotifyTone = 'info') => {
    setToast({ msg, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const applyOverview = useCallback(
    (data: OverviewResponse) => {
      setOverview(data);
      setLoadError(null);
      setLoading(false);

      const defaultWs = activeSessionCwd || data.workspaceHints[0] || '';
      if (defaultWs) {
        setSelectedWorkspace((prev) => prev || defaultWs);
      }
      if (!selectedRulesSessionId && (activeSessionId || data.activeSessions[0]?.sessionId)) {
        setSelectedRulesSessionId(activeSessionId ?? data.activeSessions[0]?.sessionId);
      }
      if (data.claude.projects.length > 0) {
        const activeSlug = data.activeSessions.find((s) => s.sessionId === activeSessionId)
          ?.claudeSlug;
        setSelectedSlug((prev) => prev || activeSlug || data.claude.projects[0].slug);
      }
    },
    [activeSessionCwd, activeSessionId, selectedRulesSessionId],
  );

  const refreshOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await unifiedMemoryApi.getOverview(activeSessionCwd);
      applyOverview(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.unknownError');
      setLoadError(msg);
      notify(t('panel.errorLoad', { message: msg }), 'danger');
      setLoading(false);
    }
  }, [activeSessionCwd, applyOverview, notify, t]);

  useEffect(() => {
    void refreshOverview();
  }, [refreshOverview]);

  const mergedWorkspaceHints = useMemo(() => {
    const set = new Set<string>();
    if (activeSessionCwd) set.add(activeSessionCwd);
    for (const h of overview?.workspaceHints ?? []) set.add(h);
    return Array.from(set);
  }, [activeSessionCwd, overview?.workspaceHints]);

  const projectHintName = useMemo(() => {
    const ws = selectedWorkspace || activeSessionCwd || '';
    if (!ws) return '';
    return ws.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '';
  }, [selectedWorkspace, activeSessionCwd]);

  return (
    <div className="um-dsh-console" data-unified-memory-console>
      <header className="um-dsh-console-header">
        <div className="um-dsh-console-header-inner">
          <div className="um-dsh-header-top">
            <div className="um-dsh-brand">
              <span className="um-dsh-brand-icon">
                <MemoryGlyph size={17} />
              </span>
              <div className="um-dsh-title-group">
                <div className="um-dsh-title-row">
                  <h1 className="um-dsh-title">{t('panel.title')}</h1>
                  <span className="um-badge">v{overview?.version ?? PLUGIN_VERSION}</span>
                  {overview && (
                    <span className="um-badge info">{overview.resolvedLocale}</span>
                  )}
                </div>
                <p className="um-dsh-subtitle">{t('panel.subtitle')}</p>
              </div>
            </div>

            <div className="um-row">
              <button
                type="button"
                className="um-btn sm"
                onClick={() => void refreshOverview()}
                disabled={loading}
              >
                <RefreshIcon size={12} />
                <span>{loading ? t('panel.syncing') : t('panel.sync')}</span>
              </button>
            </div>
          </div>

          <nav className="um-dsh-tabs" aria-label={t('tabs.ariaLabel')}>
            <button
              type="button"
              className={`um-dsh-tab ${tab === 'overview' ? 'active' : ''}`}
              onClick={() => setTab('overview')}
            >
              {t('tabs.overview')}
            </button>
            <button
              type="button"
              className={`um-dsh-tab ${tab === 'claude' ? 'active' : ''}`}
              onClick={() => setTab('claude')}
            >
              {t('tabs.claude', { count: overview?.claude.totalTopics ?? 0 })}
            </button>
            <button
              type="button"
              className={`um-dsh-tab ${tab === 'codex' ? 'active' : ''}`}
              onClick={() => setTab('codex')}
            >
              {t('tabs.codex')}
            </button>
            <button
              type="button"
              className={`um-dsh-tab ${tab === 'rules' ? 'active' : ''}`}
              onClick={() => setTab('rules')}
            >
              {t('tabs.rules')}
            </button>
          </nav>
        </div>
      </header>

      <main className="um-dsh-console-body">
        <div className="um-dsh-console-inner">
          {toast && (
            <div className={`um-banner ${toast.tone}`}>
              <span>{toast.msg}</span>
              <button type="button" className="um-btn sm" onClick={() => setToast(null)}>
                {t('panel.dismiss')}
              </button>
            </div>
          )}

          {loadError && !overview && (
            <div className="um-banner danger">
              <span>{t('panel.errorLoad', { message: loadError })}</span>
              <button type="button" className="um-btn sm" onClick={() => void refreshOverview()}>
                {t('common.refresh')}
              </button>
            </div>
          )}

          {!overview ? (
            !loadError && <div className="um-empty">{t('panel.loading')}</div>
          ) : (
            <>
              {tab === 'overview' && (
                <OverviewTab
                  overview={overview}
                  t={t}
                  onRefresh={refreshOverview}
                  onSelectClaudeProject={(slug) => {
                    setSelectedSlug(slug);
                    setTab('claude');
                  }}
                  onSelectRulesWorkspace={(wsPath, sessionId) => {
                    setSelectedWorkspace(wsPath);
                    if (sessionId) setSelectedRulesSessionId(sessionId);
                    setTab('rules');
                  }}
                  onNotify={notify}
                />
              )}

              {tab === 'claude' && (
                <ClaudeTab
                  projects={overview.claude.projects}
                  selectedSlug={selectedSlug}
                  onSelectSlug={setSelectedSlug}
                  t={t}
                  onOverviewRefresh={refreshOverview}
                  onNotify={notify}
                />
              )}

              {tab === 'codex' && (
                <CodexTab
                  defaultProjectHint={projectHintName}
                  t={t}
                  onNotify={notify}
                />
              )}

              {tab === 'rules' && (
                <RulesTab
                  workspaceHints={mergedWorkspaceHints}
                  selectedWorkspace={selectedWorkspace}
                  selectedSessionId={selectedRulesSessionId}
                  onSelectWorkspace={setSelectedWorkspace}
                  t={t}
                  onNotify={notify}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
