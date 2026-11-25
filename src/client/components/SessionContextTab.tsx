import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import type { LiveSessionContextSnapshot } from '../../shared/api-contract.js';
import { unifiedMemoryApi } from '../api.js';
import type {
  RightTabSlotRuntimeProps,
  RightTabTitleSlotRuntimeProps,
} from '../dsh-types.js';
import { createFallbackTranslator } from '../i18n.js';
import { MemoryGlyph, RefreshIcon } from '../icons.js';

function fmtBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function fmtShortTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Right Sidebar tab chip title (`sidebar.right.pane.tab.title`). */
export function SessionContextTitle({ t }: RightTabTitleSlotRuntimeProps): ReactElement {
  const translate = t ?? createFallbackTranslator('en');
  return (
    <>
      <MemoryGlyph size={15} className="um-dsh-tab-title-icon" />
      <span>{translate('rightTab.title')}</span>
    </>
  );
}

/** Right Sidebar per-session memory inspector (`sidebar.right.pane.tab`). */
export function SessionContextTab(props: RightTabSlotRuntimeProps): ReactElement {
  const { sessionId, useSessions, useTabInfo, t: slotT, openGlobalConsole } = props;
  const t = useMemo(() => slotT ?? createFallbackTranslator('en'), [slotT]);

  const tabInfo = useTabInfo ? useTabInfo() : undefined;
  const tabVisible = tabInfo?.tab.visible ?? true;

  // Primitive selector keeps useSyncExternalStore strictly referentially stable.
  const liveSessionCwd = useSessions
    ? useSessions((state) => (sessionId ? (state.byId[sessionId]?.cwd ?? '') : ''))
    : '';

  const [snapshot, setSnapshot] = useState<LiveSessionContextSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setSnapshot(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await unifiedMemoryApi.getSessionContext(sessionId);
      setSnapshot(res.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unknownError'));
    } finally {
      setLoading(false);
    }
  }, [sessionId, t]);

  useEffect(() => {
    if (!tabInfo) return;
    return tabInfo.tab.actions.bindCommands({
      refresh: () => {
        void refresh();
      },
    });
  }, [tabInfo, refresh]);

  useEffect(() => {
    if (tabVisible) {
      void refresh();
    }
  }, [sessionId, liveSessionCwd, tabVisible, refresh]);

  if (!sessionId) {
    return (
      <div className="um-dsh-right-tab">
        <div className="um-empty">{t('rightTab.noSession')}</div>
      </div>
    );
  }

  const displayCwd = snapshot?.cwd || liveSessionCwd || snapshot?.resolvedProjectRoot || '';
  const memIdx = snapshot?.claudeMemoryIndex ?? null;
  const linePct = memIdx ? Math.min(100, (memIdx.totalLines / memIdx.maxLines) * 100) : 0;
  const bytePct = memIdx ? Math.min(100, (memIdx.totalBytes / memIdx.maxBytes) * 100) : 0;
  const lineTone = linePct >= 95 ? 'danger' : linePct >= 80 ? 'warn' : '';
  const byteTone = bytePct >= 95 ? 'danger' : bytePct >= 80 ? 'warn' : '';

  const originLabel =
    snapshot?.origin === 'subagent'
      ? snapshot.isSeeded
        ? t('rightTab.originFork')
        : t('rightTab.originSubagent')
      : t('rightTab.originRoot');

  const triggeredConditional = (snapshot?.indexedConditionalRules ?? []).filter((r) => r.loaded);
  const pendingConditional = (snapshot?.indexedConditionalRules ?? []).filter((r) => !r.loaded);

  return (
    <div className="um-dsh-right-tab" data-unified-memory-session-tab>
      <div className="um-dsh-right-header">
        <div className="um-dsh-right-title" title={displayCwd || sessionId}>
          <MemoryGlyph size={14} />
          <span>{t('rightTab.title')}</span>
        </div>
        <div className="um-row" style={{ gap: 4 }}>
          <button
            type="button"
            className="um-btn sm"
            onClick={() => void refresh()}
            disabled={loading}
            title={t('common.refresh')}
          >
            <RefreshIcon size={11} />
          </button>
          {openGlobalConsole && (
            <button type="button" className="um-btn sm" onClick={openGlobalConsole}>
              {t('rightTab.openConsole')}
            </button>
          )}
        </div>
      </div>

      <div className="um-dsh-right-body">
        {error && <div className="um-banner danger" style={{ marginBottom: 0 }}>{error}</div>}

        {!snapshot ? (
          <div className="um-dsh-right-card">
            {liveSessionCwd && (
              <div className="um-mono um-muted" style={{ marginBottom: 8 }}>
                {liveSessionCwd}
              </div>
            )}
            <div className="um-muted">
              {loading ? t('common.loading') : t('rightTab.notYetInjected')}
            </div>
          </div>
        ) : (
          <>
            {snapshot.pendingExternalApprovalCount > 0 && (
              <div className="um-banner warn" style={{ marginBottom: 0 }}>
                <span>
                  {t('rightTab.pendingExternal', {
                    count: snapshot.pendingExternalApprovalCount,
                  })}
                </span>
                {openGlobalConsole && (
                  <button type="button" className="um-btn sm" onClick={openGlobalConsole}>
                    {t('rightTab.openConsole')}
                  </button>
                )}
              </div>
            )}

            {/* Session Summary */}
            <div className="um-dsh-right-card">
              <div className="um-row-between" style={{ marginBottom: 8 }}>
                <span className="um-badge info">{snapshot.resolvedLocale}</span>
                <span className="um-caption">
                  {t('rightTab.updatedAt', { ts: fmtShortTime(snapshot.updatedAt) })}
                </span>
              </div>
              <div className="um-dsh-right-kv">
                <span className="um-kv-key">{t('rightTab.baseline')}</span>
                <span className="um-row" style={{ gap: 4 }}>
                  <span className={`um-badge ${snapshot.baselineInjected ? 'success' : 'warn'}`}>
                    {snapshot.baselineInjected
                      ? t('rightTab.baselineInjected', { bytes: fmtBytes(snapshot.baselineBytes) })
                      : t('rightTab.baselinePending')}
                  </span>
                </span>

                <span className="um-kv-key">{t('rightTab.compactions')}</span>
                <span className="um-row" style={{ gap: 4 }}>
                  <span className={`um-badge ${snapshot.compactionCount > 0 ? 'warn' : ''}`}>
                    {snapshot.compactionCount}
                  </span>
                  <span className="um-caption">
                    {t('rightTab.replaceGen', { gen: snapshot.replaceGeneration })}
                  </span>
                </span>

                <span className="um-kv-key">{t('rightTab.hostDedup')}</span>
                <span>
                  <span
                    className={`um-badge ${snapshot.hostAgentInstructionsActive ? 'info' : ''}`}
                  >
                    {snapshot.hostAgentInstructionsActive
                      ? t('rightTab.hostDedupActive', { count: snapshot.hostLoadedPaths.length })
                      : t('rightTab.hostDedupInactive')}
                  </span>
                </span>

                <span className="um-kv-key">{t('rightTab.codexInjected')}</span>
                <span>
                  <span className={`um-badge ${snapshot.codexSummaryInjected ? 'success' : ''}`}>
                    {snapshot.codexSummaryInjected ? t('common.yes') : t('common.no')}
                  </span>
                </span>

                {displayCwd && (
                  <>
                    <span className="um-kv-key">{t('rightTab.cwd')}</span>
                    <span className="um-mono">{displayCwd}</span>
                  </>
                )}

                {snapshot.claudeSlug && (
                  <>
                    <span className="um-kv-key">{t('rightTab.slug')}</span>
                    <span className="um-mono">{snapshot.claudeSlug}</span>
                  </>
                )}
              </div>
              <div className="um-caption" style={{ marginTop: 6 }}>
                {originLabel}
              </div>
            </div>

            {/* Claude MEMORY.md Quick Budget */}
            {memIdx && (
              <div className="um-dsh-right-card">
                <div className="um-dsh-right-section-title">
                  <span>{t('rightTab.memoryIndex')}</span>
                  <span className={`um-badge ${memIdx.truncated ? 'danger' : 'success'}`}>
                    {memIdx.topicCount}
                  </span>
                </div>
                <div className="um-row-between um-caption">
                  <span>{t('claude.linesLabel')}</span>
                  <span className="um-mono">
                    {memIdx.totalLines}/{memIdx.maxLines}
                  </span>
                </div>
                <div className="um-progress-track" style={{ marginBottom: 6 }}>
                  <div
                    className={`um-progress-fill ${lineTone}`}
                    style={{ width: `${linePct}%` }}
                  />
                </div>
                <div className="um-row-between um-caption">
                  <span>{t('claude.sizeLabel')}</span>
                  <span className="um-mono">
                    {(memIdx.totalBytes / 1024).toFixed(1)}/{(memIdx.maxBytes / 1024).toFixed(0)} KB
                  </span>
                </div>
                <div className="um-progress-track">
                  <div
                    className={`um-progress-fill ${byteTone}`}
                    style={{ width: `${bytePct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Host-Deduped Files */}
            {snapshot.hostLoadedPaths.length > 0 && (
              <div className="um-dsh-right-card">
                <h4 className="um-dsh-right-section-title">
                  {t('rightTab.sectionHostDeduped', { count: snapshot.hostLoadedPaths.length })}
                </h4>
                <div className="um-dsh-chip-list">
                  {snapshot.hostLoadedPaths.map((p) => (
                    <div className="um-dsh-chip-row um-mono" key={p}>
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loaded Always-On Rules */}
            {snapshot.loadedAlwaysOnRules.length > 0 && (
              <div className="um-dsh-right-card">
                <h4 className="um-dsh-right-section-title">
                  {t('rightTab.sectionAlwaysOn', { count: snapshot.loadedAlwaysOnRules.length })}
                </h4>
                <div className="um-dsh-chip-list">
                  {snapshot.loadedAlwaysOnRules.map((rule) => (
                    <div className="um-dsh-chip-row" key={rule.filePath}>
                      <div className="um-row" style={{ gap: 4, marginBottom: 2 }}>
                        <span className="um-badge info">{rule.scope}</span>
                        {rule.dedupedByHost && (
                          <span className="um-badge warn">{t('rules.badgeHostDeduped')}</span>
                        )}
                        {rule.importsCount > 0 && (
                          <span className="um-badge">@{rule.importsCount}</span>
                        )}
                      </div>
                      <div className="um-mono">{rule.displayPath}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Triggered Subdirectory CLAUDE.md */}
            {snapshot.loadedSubdirClaudeMds.length > 0 && (
              <div className="um-dsh-right-card">
                <h4 className="um-dsh-right-section-title">
                  {t('rightTab.sectionLazySubdirs', {
                    count: snapshot.loadedSubdirClaudeMds.length,
                  })}
                </h4>
                <div className="um-dsh-chip-list">
                  {snapshot.loadedSubdirClaudeMds.map((sub) => (
                    <div className="um-dsh-chip-row" key={sub.filePath}>
                      <div className="um-mono">{sub.displayPath}</div>
                      <div className="um-caption um-mono">← {sub.triggeredBy}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Indexed Path-Scoped Rules */}
            {snapshot.indexedConditionalRules.length > 0 && (
              <div className="um-dsh-right-card">
                <h4 className="um-dsh-right-section-title">
                  {t('rightTab.sectionConditional', {
                    count: snapshot.indexedConditionalRules.length,
                  })}
                </h4>
                <div className="um-dsh-chip-list">
                  {[...triggeredConditional, ...pendingConditional].map((rule) => (
                    <div className="um-dsh-chip-row" key={rule.id}>
                      <div className="um-row" style={{ gap: 4, marginBottom: 2 }}>
                        <span className={`um-badge ${rule.loaded ? 'success' : ''}`}>
                          {rule.loaded ? t('rightTab.ruleLoaded') : t('rightTab.ruleStandby')}
                        </span>
                        <span className="um-badge info">{rule.scope}</span>
                      </div>
                      <div className="um-mono">{rule.displayPath}</div>
                      {rule.paths.length > 0 && (
                        <div className="um-caption um-mono">{rule.paths.join(', ')}</div>
                      )}
                      {rule.triggeredBy && (
                        <div className="um-caption um-mono">← {rule.triggeredBy}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Injected Labels */}
            {snapshot.injectedLabels.length > 0 && (
              <div className="um-dsh-right-card">
                <h4 className="um-dsh-right-section-title">
                  {t('rightTab.sectionInjected', { count: snapshot.injectedLabels.length })}
                </h4>
                <div className="um-row" style={{ gap: 4 }}>
                  {snapshot.injectedLabels.map((lbl, idx) => (
                    <span className="um-badge" key={`${lbl}-${idx}`}>
                      {lbl}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
