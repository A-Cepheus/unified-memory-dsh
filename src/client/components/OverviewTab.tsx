import { useState, type ReactElement } from 'react';
import type {
  ClaudeProjectResolution,
  ConfigUpdateRequest,
  LocalePreference,
  OverviewResponse,
} from '../../shared/api-contract.js';
import { unifiedMemoryApi } from '../api.js';
import type { ClientTranslateFn } from '../dsh-types.js';

export type NotifyTone = 'info' | 'success' | 'warn' | 'danger';

interface OverviewTabProps {
  readonly overview: OverviewResponse;
  readonly t: ClientTranslateFn;
  readonly onRefresh: () => Promise<void>;
  readonly onSelectClaudeProject: (slug: string) => void;
  readonly onSelectRulesWorkspace: (wsPath: string, sessionId?: string) => void;
  readonly onNotify: (msg: string, tone?: NotifyTone) => void;
}

function fmtBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function fmtTime(isoOrMs: string | number): string {
  if (!isoOrMs) return '—';
  const d = new Date(isoOrMs);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function OverviewTab({
  overview,
  t,
  onRefresh,
  onSelectClaudeProject,
  onSelectRulesWorkspace,
  onNotify,
}: OverviewTabProps): ReactElement {
  const [probePath, setProbePath] = useState(overview.workspaceHints[0] ?? '');
  const [resolution, setResolution] = useState<ClaudeProjectResolution | null>(null);
  const [resolving, setResolving] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);

  const handleResolve = async () => {
    const trimmed = probePath.trim();
    if (!trimmed) return;
    setResolving(true);
    try {
      const res = await unifiedMemoryApi.resolveClaudeProject(trimmed);
      setResolution(res);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t('common.unknownError'), 'danger');
    } finally {
      setResolving(false);
    }
  };

  const updateCfg = async (patch: ConfigUpdateRequest) => {
    setSavingCfg(true);
    try {
      await unifiedMemoryApi.updateConfig(patch);
      await onRefresh();
      onNotify(t('overview.settingsSaved'), 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t('common.unknownError'), 'danger');
    } finally {
      setSavingCfg(false);
    }
  };

  const handleClearDiagnostics = async () => {
    try {
      await unifiedMemoryApi.clearDiagnostics();
      await onRefresh();
      onNotify(t('overview.logCleared'), 'info');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t('common.unknownError'), 'danger');
    }
  };

  const activeCodexGen =
    overview.codex.activeGeneration === 'v2'
      ? overview.codex.v2
      : overview.codex.activeGeneration === 'v1'
        ? overview.codex.v1
        : null;

  const activeIds = new Set(overview.activeSessions.map((s) => s.sessionId));
  const nonActiveRecent = overview.recentSessions.filter((s) => !activeIds.has(s.conversationId));

  return (
    <div>
      {/* Inventory Summary Cards */}
      <div className="um-grid-2 um-section">
        <div className="um-card">
          <div className="um-card-header">
            <h3 className="um-card-title">{t('overview.claudeTitle')}</h3>
            <span className={`um-badge ${overview.claude.exists ? 'success' : 'warn'}`}>
              {overview.claude.exists ? t('overview.claudeReady') : t('overview.claudeMissing')}
            </span>
          </div>
          <div className="um-kv">
            <span className="um-kv-key">{t('overview.configDir')}</span>
            <span className="um-mono">{overview.claude.configDir}</span>
            <span className="um-kv-key">{t('overview.projects')}</span>
            <span>
              {t('overview.projectsSummary', {
                projects: overview.claude.projectCount,
                topics: overview.claude.totalTopics,
              })}
            </span>
            <span className="um-kv-key">{t('overview.globalFiles')}</span>
            <span className="um-row">
              <span className={`um-badge ${overview.claude.hasGlobalClaudeMd ? 'info' : ''}`}>
                CLAUDE.md: {overview.claude.hasGlobalClaudeMd ? t('common.yes') : t('common.no')}
              </span>
              <span className={`um-badge ${overview.claude.hasGlobalRulesDir ? 'info' : ''}`}>
                rules/: {overview.claude.hasGlobalRulesDir ? t('common.yes') : t('common.no')}
              </span>
            </span>
            <span className="um-kv-key">{t('overview.writeSchema')}</span>
            <span className="um-mono">{t('overview.writeSchemaVal')}</span>
          </div>
        </div>

        <div className="um-card">
          <div className="um-card-header">
            <h3 className="um-card-title">{t('overview.codexTitle')}</h3>
            <span className={`um-badge ${activeCodexGen ? 'info' : 'warn'}`}>
              {activeCodexGen
                ? t('overview.codexReadOnly', { gen: overview.codex.activeGeneration })
                : t('overview.codexMissing')}
            </span>
          </div>
          <div className="um-kv">
            <span className="um-kv-key">{t('overview.codexHome')}</span>
            <span className="um-mono">{overview.codex.codexHome}</span>
            <span className="um-kv-key">{t('overview.activeStore')}</span>
            <span>
              {activeCodexGen
                ? t('overview.codexActiveSummary', {
                    gen: activeCodexGen.generation,
                    bytes: fmtBytes(activeCodexGen.summaryBytes),
                    lines: activeCodexGen.summaryLines,
                    rollouts: activeCodexGen.rolloutCount,
                  })
                : t('overview.codexNoDir')}
            </span>
            <span className="um-kv-key">{t('overview.generations')}</span>
            <span className="um-row">
              <span className={`um-badge ${overview.codex.v2.exists ? 'success' : ''}`}>
                memories_v2: {overview.codex.v2.exists ? t('common.yes') : t('common.no')}
              </span>
              <span className={`um-badge ${overview.codex.v1.exists ? 'info' : ''}`}>
                memories (v1): {overview.codex.v1.exists ? t('common.yes') : t('common.no')}
              </span>
            </span>
            <span className="um-kv-key">{t('overview.configFlags')}</span>
            <span className="um-mono">
              memories={String(overview.codex.configFlags.featuresMemories ?? t('common.unset'))} ·
              use={String(overview.codex.configFlags.useMemories ?? t('common.unset'))}
            </span>
          </div>
        </div>
      </div>

      {/* Project Slug & Git Worktree Resolver */}
      <div className="um-card um-section">
        <div className="um-card-header">
          <h3 className="um-card-title">{t('overview.resolverTitle')}</h3>
          <span className="um-muted">{t('overview.resolverSubtitle')}</span>
        </div>
        <div className="um-row">
          <input
            className="um-input"
            style={{ flex: 1, minWidth: 200 }}
            value={probePath}
            onChange={(e) => setProbePath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleResolve();
            }}
            placeholder={t('overview.resolverPlaceholder')}
            list="um-dsh-workspace-hints"
          />
          <datalist id="um-dsh-workspace-hints">
            {overview.workspaceHints.map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>
          <button
            type="button"
            className="um-btn primary"
            onClick={() => void handleResolve()}
            disabled={resolving || !probePath.trim()}
          >
            {resolving ? t('overview.resolving') : t('overview.resolve')}
          </button>
        </div>

        {resolution && (
          <div className="um-item" style={{ marginTop: 10 }}>
            <div className="um-kv">
              <span className="um-kv-key">{t('overview.mainRepoRoot')}</span>
              <span className="um-mono">
                {resolution.resolvedRoot}{' '}
                {resolution.isGitWorktree && (
                  <span className="um-badge info">{t('overview.worktreeBadge')}</span>
                )}
              </span>
              <span className="um-kv-key">{t('overview.encodedSlug')}</span>
              <span className="um-mono">{resolution.slug}</span>
              <span className="um-kv-key">{t('overview.memoryDir')}</span>
              <span className="um-mono">
                {resolution.memoryDir}{' '}
                <span className={`um-badge ${resolution.exists ? 'success' : 'warn'}`}>
                  {resolution.exists ? t('overview.dirExists') : t('overview.dirWillCreate')}
                </span>
              </span>
            </div>
            <div className="um-row" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="um-btn sm"
                onClick={() => onSelectClaudeProject(resolution.slug)}
              >
                {t('overview.openInClaudeTab')}
              </button>
              <button
                type="button"
                className="um-btn sm"
                onClick={() => onSelectRulesWorkspace(resolution.resolvedRoot)}
              >
                {t('overview.inspectRulesForWorkspace')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live Injection & Localization Settings */}
      <div className="um-card um-section">
        <div className="um-card-header">
          <h3 className="um-card-title">{t('overview.settingsTitle')}</h3>
          <span className="um-muted um-mono">
            {t('overview.settingsSubtitle', { dir: overview.pluginDataDir })}
          </span>
        </div>

        <div className="um-toggle">
          <div>
            <div>{t('overview.localeLabel')}</div>
            <div className="um-muted">
              {t('overview.localeDesc', {
                resolved: overview.resolvedLocale,
                hostPref: overview.hostLocalePreference ?? t('common.unset'),
              })}
            </div>
          </div>
          <select
            className="um-select"
            style={{ width: 210, flexShrink: 0 }}
            value={overview.config.locale}
            disabled={savingCfg}
            onChange={(e) => void updateCfg({ locale: e.target.value as LocalePreference })}
          >
            <option value="auto">{t('overview.localeAuto')}</option>
            <option value="zh">{t('overview.localeZh')}</option>
            <option value="en">{t('overview.localeEn')}</option>
          </select>
        </div>

        <div className="um-toggle">
          <div>
            <div>{t('overview.codexStartLabel')}</div>
            <div className="um-muted">{t('overview.codexStartDesc')}</div>
          </div>
          <input
            type="checkbox"
            className="um-checkbox"
            checked={overview.config.injectCodexSummaryOnStart}
            disabled={savingCfg}
            onChange={(e) => void updateCfg({ injectCodexSummaryOnStart: e.target.checked })}
          />
        </div>

        <div className="um-toggle">
          <div>
            <div>{t('overview.codexBudgetLabel')}</div>
            <div className="um-muted">{t('overview.codexBudgetDesc')}</div>
          </div>
          <select
            className="um-select"
            style={{ width: 120, flexShrink: 0 }}
            value={overview.config.codexSummaryMaxBytes}
            disabled={savingCfg}
            onChange={(e) => void updateCfg({ codexSummaryMaxBytes: Number(e.target.value) })}
          >
            <option value={4096}>4 KB</option>
            <option value={8192}>8 KB</option>
            <option value={16384}>16 KB</option>
            <option value={32768}>32 KB</option>
          </select>
        </div>

        <div className="um-toggle">
          <div>
            <div>{t('overview.maxStartupBudgetLabel')}</div>
            <div className="um-muted">{t('overview.maxStartupBudgetDesc')}</div>
          </div>
          <select
            className="um-select"
            style={{ width: 120, flexShrink: 0 }}
            value={overview.config.maxStartupInjectBytes}
            disabled={savingCfg}
            onChange={(e) => void updateCfg({ maxStartupInjectBytes: Number(e.target.value) })}
          >
            <option value={32768}>32 KB</option>
            <option value={65536}>64 KB</option>
            <option value={131072}>128 KB</option>
            <option value={262144}>256 KB</option>
          </select>
        </div>

        <div className="um-toggle">
          <div>
            <div>{t('overview.dedupLabel')}</div>
            <div className="um-muted">{t('overview.dedupDesc')}</div>
          </div>
          <input
            type="checkbox"
            className="um-checkbox"
            checked={overview.config.deduplicateNativeAgentsMd}
            disabled={savingCfg}
            onChange={(e) => void updateCfg({ deduplicateNativeAgentsMd: e.target.checked })}
          />
        </div>

        <div className="um-toggle">
          <div>
            <div>{t('overview.reuseApprovalsLabel')}</div>
            <div className="um-muted">{t('overview.reuseApprovalsDesc')}</div>
          </div>
          <input
            type="checkbox"
            className="um-checkbox"
            checked={overview.config.trustClaudeCodeExternalApprovals}
            disabled={savingCfg}
            onChange={(e) =>
              void updateCfg({ trustClaudeCodeExternalApprovals: e.target.checked })
            }
          />
        </div>

        <div className="um-toggle">
          <div>
            <div>{t('overview.codexGlobalAgentsLabel')}</div>
            <div className="um-muted">{t('overview.codexGlobalAgentsDesc')}</div>
          </div>
          <input
            type="checkbox"
            className="um-checkbox"
            checked={overview.config.injectCodexGlobalAgentsMd}
            disabled={savingCfg}
            onChange={(e) => void updateCfg({ injectCodexGlobalAgentsMd: e.target.checked })}
          />
        </div>
      </div>

      {/* Active & Recent Sessions */}
      <div className="um-card um-section">
        <div className="um-card-header">
          <h3 className="um-card-title">
            {t('overview.sessionsTitle', {
              active: overview.activeSessions.length,
              recent: nonActiveRecent.length,
            })}
          </h3>
          <span className="um-muted">{t('overview.sessionsSubtitle')}</span>
        </div>

        {overview.activeSessions.length === 0 && nonActiveRecent.length === 0 ? (
          <div className="um-empty">{t('overview.sessionsEmpty')}</div>
        ) : (
          <div className="um-list">
            {overview.activeSessions.map((s) => (
              <div className="um-item" key={`live-${s.sessionId}`}>
                <div className="um-row-between">
                  <div className="um-row">
                    <span className="um-badge success">{t('overview.sessionActive')}</span>
                    <span className="um-mono">{s.sessionId.slice(0, 14)}</span>
                    <span className="um-badge info">{s.resolvedLocale}</span>
                    <span className={`um-badge ${s.baselineInjected ? 'success' : 'warn'}`}>
                      {s.baselineInjected
                        ? t('overview.sessionBaselineOn')
                        : t('overview.sessionBaselineOff')}
                    </span>
                    {s.compactionCount > 0 && (
                      <span className="um-badge warn">
                        {t('overview.sessionCompactions', { count: s.compactionCount })}
                      </span>
                    )}
                    {s.hostDedupedCount > 0 && (
                      <span className="um-badge">
                        {t('overview.sessionDeduped', { count: s.hostDedupedCount })}
                      </span>
                    )}
                  </div>
                  <div className="um-row">
                    <span className="um-muted">{fmtTime(s.updatedAt)}</span>
                    {(s.resolvedProjectRoot || s.cwd) && (
                      <button
                        type="button"
                        className="um-btn sm"
                        onClick={() =>
                          onSelectRulesWorkspace(s.resolvedProjectRoot ?? s.cwd ?? '', s.sessionId)
                        }
                      >
                        {t('overview.sessionInspectRules')}
                      </button>
                    )}
                  </div>
                </div>
                {(s.cwd || s.resolvedProjectRoot) && (
                  <div className="um-mono um-muted" style={{ marginTop: 4 }}>
                    {s.cwd ?? s.resolvedProjectRoot}
                  </div>
                )}
              </div>
            ))}

            {nonActiveRecent.slice(0, 10).map((s) => (
              <div className="um-item" key={`recent-${s.conversationId}`}>
                <div className="um-row-between">
                  <div className="um-row">
                    <span className="um-badge">{t('overview.sessionRecent')}</span>
                    <span className="um-mono">{s.conversationId.slice(0, 14)}</span>
                    {s.locale && <span className="um-badge info">{s.locale}</span>}
                    {s.compactionCount > 0 && (
                      <span className="um-badge warn">
                        {t('overview.sessionCompactions', { count: s.compactionCount })}
                      </span>
                    )}
                    {s.hostDedupedCount > 0 && (
                      <span className="um-badge">
                        {t('overview.sessionDeduped', { count: s.hostDedupedCount })}
                      </span>
                    )}
                  </div>
                  <div className="um-row">
                    <span className="um-muted">{fmtTime(s.updatedAt)}</span>
                    {s.workspacePaths[0] && (
                      <button
                        type="button"
                        className="um-btn sm"
                        onClick={() => onSelectRulesWorkspace(s.workspacePaths[0], s.conversationId)}
                      >
                        {t('overview.sessionInspectRules')}
                      </button>
                    )}
                  </div>
                </div>
                {s.workspacePaths[0] && (
                  <div className="um-mono um-muted" style={{ marginTop: 4 }}>
                    {s.workspacePaths[0]}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Pre-Step / Hook Diagnostics */}
      <div className="um-card um-section">
        <div className="um-card-header">
          <h3 className="um-card-title">
            {t('overview.diagnosticsTitle', { count: overview.diagnostics.length })}
          </h3>
          <div className="um-row">
            <button type="button" className="um-btn sm" onClick={() => void onRefresh()}>
              {t('common.refresh')}
            </button>
            <button
              type="button"
              className="um-btn sm"
              onClick={() => void handleClearDiagnostics()}
              disabled={overview.diagnostics.length === 0}
            >
              {t('overview.clearLog')}
            </button>
          </div>
        </div>

        {overview.diagnostics.length === 0 ? (
          <div className="um-empty">{t('overview.diagnosticsEmpty')}</div>
        ) : (
          <div className="um-list">
            {overview.diagnostics.slice(0, 25).map((ev, idx) => (
              <div className="um-item" key={`${ev.ts}-${idx}`}>
                <div className="um-row-between">
                  <div className="um-row">
                    <span
                      className={`um-badge ${
                        ev.error
                          ? 'danger'
                          : ev.event === 'BaselineInject' ||
                              ev.event === 'SessionStart' ||
                              ev.event.includes('pre-step')
                            ? 'success'
                            : ev.event === 'CompactionReload' || ev.event === 'ManualReload'
                              ? 'warn'
                              : 'info'
                      }`}
                    >
                      {ev.event}
                    </span>
                    <span className="um-mono">{ev.elapsedMs.toFixed(1)} ms</span>
                    {ev.locale && <span className="um-badge info">{ev.locale}</span>}
                    {ev.compactionReload && (
                      <span className="um-badge warn">{t('overview.compactionReload')}</span>
                    )}
                    {typeof ev.hostDedupedCount === 'number' && ev.hostDedupedCount > 0 && (
                      <span className="um-badge">
                        {t('overview.hostDedupedCount', { count: ev.hostDedupedCount })}
                      </span>
                    )}
                    {ev.toolName && <span className="um-badge">{ev.toolName}</span>}
                  </div>
                  <span className="um-muted">{fmtTime(ev.ts)}</span>
                </div>
                {ev.injectedLabels.length > 0 && (
                  <div className="um-row" style={{ marginTop: 6 }}>
                    {ev.injectedLabels.map((lbl, i) => (
                      <span className="um-badge" key={`${lbl}-${i}`}>
                        {lbl}
                      </span>
                    ))}
                  </div>
                )}
                {ev.error && (
                  <div className="um-mono" style={{ color: 'var(--um-danger-fg)', marginTop: 4 }}>
                    {t('overview.errorPrefix', { error: ev.error })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
