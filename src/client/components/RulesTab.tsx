import { useCallback, useEffect, useState, type ReactElement } from 'react';
import type {
  ApprovedExternalRuleTarget,
  BlockedExternalRuleTarget,
} from '../../core/types.js';
import type {
  ClaudeRuleEntry,
  RulesInspectResponse,
  TrustUpdateRequest,
} from '../../shared/api-contract.js';
import { unifiedMemoryApi } from '../api.js';
import type { ClientTranslateFn } from '../dsh-types.js';
import type { NotifyTone } from './OverviewTab.js';

interface RulesTabProps {
  readonly workspaceHints: string[];
  readonly selectedWorkspace: string;
  readonly selectedSessionId?: string;
  readonly onSelectWorkspace: (ws: string) => void;
  readonly t: ClientTranslateFn;
  readonly onNotify: (msg: string, tone?: NotifyTone) => void;
}

function getSafeParentDir(targetPath: string): string | null {
  const normalized = targetPath.replace(/[\\/]+$/, '');
  const idx = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  if (idx <= 0) return null;
  const parent = normalized.slice(0, idx);
  const segments = parent.split(/[\\/]/).filter(Boolean);
  if (
    (segments.length <= 2 && (segments[0] === 'Users' || segments[0] === 'home')) ||
    (segments.length <= 3 && /^[A-Za-z]:$/.test(segments[0]) && segments[1] === 'Users')
  ) {
    return null;
  }
  return parent;
}

export function RulesTab({
  workspaceHints,
  selectedWorkspace,
  selectedSessionId,
  onSelectWorkspace,
  t,
  onNotify,
}: RulesTabProps): ReactElement {
  const [inputPath, setInputPath] = useState(selectedWorkspace || workspaceHints[0] || '');
  const [manualTrustPath, setManualTrustPath] = useState('');
  const [data, setData] = useState<RulesInspectResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingTrust, setSavingTrust] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const inspect = useCallback(
    async (wsPath: string, sessionId?: string) => {
      setLoading(true);
      try {
        const res = await unifiedMemoryApi.inspectRules({
          workspacePath: wsPath.trim() || undefined,
          sessionId: sessionId || undefined,
        });
        setData(res);
      } catch (err) {
        onNotify(err instanceof Error ? err.message : t('common.unknownError'), 'danger');
      } finally {
        setLoading(false);
      }
    },
    [onNotify, t],
  );

  const updateExternalTrust = async (
    workspacePath: string,
    action: TrustUpdateRequest['action'],
    targetPath?: string,
  ) => {
    setSavingTrust(true);
    try {
      await unifiedMemoryApi.updateTrust({
        workspacePath,
        action,
        ...(targetPath ? { targetPath } : {}),
      });
      await inspect(workspacePath, selectedSessionId);
      const msg =
        action === 'allow'
          ? t('rules.trustApprovedToast')
          : action === 'deny'
            ? t('rules.trustDeniedToast')
            : t('rules.trustUpdatedToast');
      onNotify(msg, action === 'allow' ? 'success' : 'info');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t('common.unknownError'), 'danger');
    } finally {
      setSavingTrust(false);
    }
  };

  useEffect(() => {
    const target = selectedWorkspace || workspaceHints[0] || '';
    setInputPath(target);
    void inspect(target, selectedSessionId);
  }, [selectedWorkspace, selectedSessionId, inspect]);

  const formatKindLabel = (kind: BlockedExternalRuleTarget['kind']): string =>
    t(`rules.kind.${kind}`);

  const formatBlockStatusLabel = (status: BlockedExternalRuleTarget['status']): string =>
    t(`rules.blockStatus.${status}`);

  const formatApprovalSourceLabel = (source: ApprovedExternalRuleTarget['approvedBy']): string =>
    t(`rules.approvalSource.${source}`);

  const renderRuleCard = (rule: ClaudeRuleEntry) => {
    const isExpanded = expandedId === rule.id;
    const hasExpandedImports = rule.dedupedByHost && rule.importedOnlyContent.trim().length > 0;
    return (
      <div className="um-item" key={rule.id}>
        <div className="um-row-between">
          <div className="um-row">
            <span className={`um-badge ${rule.isConditional ? 'warn' : 'success'}`}>
              {rule.isConditional ? t('rules.badgePathScoped') : t('rules.badgeAlwaysOn')}
            </span>
            <span className="um-badge info">{rule.scope}</span>
            {rule.dedupedByHost ? (
              <span className="um-badge warn">{t('rules.badgeHostDeduped')}</span>
            ) : (
              <span className="um-badge success">{t('rules.badgeLoadedByUm')}</span>
            )}
            {hasExpandedImports && (
              <span className="um-badge info">{t('rules.badgeImportsExpanded')}</span>
            )}
            <span className="um-mono">{rule.displayPath}</span>
          </div>
          <div className="um-row">
            <span className="um-muted">{rule.sizeBytes} B</span>
            <button
              type="button"
              className="um-btn sm"
              onClick={() => setExpandedId(isExpanded ? null : rule.id)}
            >
              {isExpanded ? t('common.hide') : t('common.preview')}
            </button>
          </div>
        </div>

        {rule.paths && rule.paths.length > 0 && (
          <div className="um-row" style={{ marginTop: 6 }}>
            <span className="um-muted">{t('rules.pathsLabel')}</span>
            {rule.paths.map((p) => (
              <span className="um-badge um-mono" key={p}>
                {p}
              </span>
            ))}
          </div>
        )}

        {rule.imports.length > 0 && (
          <div className="um-row" style={{ marginTop: 6 }}>
            <span className="um-muted">
              {t('rules.importsLabel', { count: rule.imports.length })}
            </span>
            {rule.imports.map((imp) => (
              <span className="um-badge info um-mono" key={imp}>
                {imp}
              </span>
            ))}
          </div>
        )}

        {rule.skippedDuplicateAgentsMd.length > 0 && (
          <div className="um-row" style={{ marginTop: 6 }}>
            <span className="um-badge warn">
              {t('rules.badgeDedupedAgents', { count: rule.skippedDuplicateAgentsMd.length })}
            </span>
          </div>
        )}

        {rule.blockedExternalTargets.length > 0 && (
          <div className="um-row" style={{ marginTop: 6 }}>
            <span className="um-badge danger">
              {t('rules.badgeBlockedExternal', { count: rule.blockedExternalTargets.length })}
            </span>
          </div>
        )}

        {isExpanded && (
          <div style={{ marginTop: 8 }}>
            {hasExpandedImports && (
              <>
                <div className="um-muted" style={{ marginBottom: 4 }}>
                  {t('rules.importedOnlyNote')}
                </div>
                <pre className="um-pre" style={{ marginBottom: 8 }}>
                  {rule.importedOnlyContent}
                </pre>
                <div className="um-muted" style={{ marginBottom: 4 }}>
                  {t('rules.fullContentNote')}
                </div>
              </>
            )}
            <pre className="um-pre">{rule.content}</pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Workspace Input */}
      <div className="um-card um-section">
        <div className="um-card-header">
          <h3 className="um-card-title">{t('rules.inspectorTitle')}</h3>
          {data && data.hostLoadedPaths.length > 0 && (
            <span className="um-badge warn">
              {t('overview.sessionDeduped', { count: data.hostLoadedPaths.length })}
            </span>
          )}
        </div>
        <div className="um-row">
          <input
            className="um-input"
            style={{ flex: 1, minWidth: 200 }}
            value={inputPath}
            onChange={(e) => setInputPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSelectWorkspace(inputPath.trim());
                void inspect(inputPath, selectedSessionId);
              }
            }}
            placeholder={t('rules.workspacePlaceholder')}
            list="um-dsh-rules-ws-hints"
          />
          <datalist id="um-dsh-rules-ws-hints">
            {workspaceHints.map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>
          <button
            type="button"
            className="um-btn primary"
            disabled={loading}
            onClick={() => {
              onSelectWorkspace(inputPath.trim());
              void inspect(inputPath, selectedSessionId);
            }}
          >
            {loading ? t('rules.scanning') : t('rules.inspect')}
          </button>
        </div>
      </div>

      {/* Global Rules */}
      {data && (
        <div className="um-card um-section">
          <div className="um-card-header">
            <h3 className="um-card-title">
              {t('rules.globalTitle', {
                count: data.globalAlwaysOn.length + data.globalConditional.length,
              })}
            </h3>
            <span className="um-muted">{t('rules.globalSubtitle')}</span>
          </div>
          {data.globalAlwaysOn.length + data.globalConditional.length === 0 ? (
            <div className="um-empty">{t('rules.globalEmpty')}</div>
          ) : (
            <div className="um-list">
              {data.globalAlwaysOn.map(renderRuleCard)}
              {data.globalConditional.map(renderRuleCard)}
            </div>
          )}
        </div>
      )}

      {/* User-Only External Imports & Rule Symlinks Trust Panel */}
      {data?.workspace && (
        <div className="um-card um-section">
          <div className="um-card-header">
            <div className="um-row">
              <h3 className="um-card-title">{t('rules.trustTitle')}</h3>
              {data.workspace.claudeCodeExternalApproval?.approved ? (
                <span className="um-badge success">
                  {data.trustClaudeCodeExternalApprovals
                    ? t('rules.claudeCodeApprovedActive')
                    : t('rules.claudeCodeApprovedIgnored')}
                </span>
              ) : data.workspace.claudeCodeExternalApproval?.warningShown ? (
                <span className="um-badge warn">{t('rules.claudeCodeDeclined')}</span>
              ) : (
                <span className="um-badge">{t('rules.claudeCodeNotApproved')}</span>
              )}
            </div>
            <span className="um-muted">{t('rules.trustSubtitle')}</span>
          </div>

          {data.workspace.blockedExternalTargets.length === 0 &&
            data.workspace.approvedExternalTargets.length === 0 && (
              <div className="um-muted" style={{ marginBottom: 10 }}>
                {t('rules.noExternalTargets')}
              </div>
            )}

          {data.workspace.blockedExternalTargets.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div className="um-muted" style={{ marginBottom: 6 }}>
                {t('rules.blockedTitle', { count: data.workspace.blockedExternalTargets.length })}
              </div>
              <div className="um-list">
                {data.workspace.blockedExternalTargets.map((item) => {
                  const parentDir = item.targetIsDir
                    ? null
                    : getSafeParentDir(item.resolvedTarget);
                  const wsRoot = data.workspace!.workspaceRoot;
                  return (
                    <div
                      className="um-item"
                      key={`${item.kind}-${item.sourceFile}-${item.resolvedTarget}`}
                    >
                      <div className="um-row-between">
                        <div className="um-row">
                          <span
                            className={`um-badge ${
                              item.status === 'pending_approval' ? 'danger' : 'warn'
                            }`}
                          >
                            {formatBlockStatusLabel(item.status)}
                          </span>
                          <span className="um-badge info">{formatKindLabel(item.kind)}</span>
                          <span className="um-mono">{item.sourceDisplayPath}</span>
                          {item.rawRef && (
                            <span className="um-muted um-mono">→ @{item.rawRef}</span>
                          )}
                        </div>
                        <div className="um-row">
                          <button
                            type="button"
                            className="um-btn sm primary"
                            disabled={savingTrust}
                            onClick={() =>
                              void updateExternalTrust(wsRoot, 'allow', item.resolvedTarget)
                            }
                          >
                            {item.targetIsDir ? t('rules.approveDir') : t('rules.approveFile')}
                          </button>
                          {parentDir && (
                            <button
                              type="button"
                              className="um-btn sm"
                              disabled={savingTrust}
                              title={parentDir}
                              onClick={() => void updateExternalTrust(wsRoot, 'allow', parentDir)}
                            >
                              {t('rules.approveParentDir')}
                            </button>
                          )}
                          {item.status === 'denied_by_plugin' ? (
                            <button
                              type="button"
                              className="um-btn sm"
                              disabled={savingTrust}
                              onClick={() =>
                                void updateExternalTrust(wsRoot, 'revoke', item.resolvedTarget)
                              }
                            >
                              {t('rules.resetTarget')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="um-btn sm"
                              disabled={savingTrust}
                              onClick={() =>
                                void updateExternalTrust(wsRoot, 'deny', item.resolvedTarget)
                              }
                            >
                              {t('rules.dismissTarget')}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="um-mono um-muted" style={{ marginTop: 4 }}>
                        {t('rules.targetPrefix', { target: item.resolvedTarget })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.workspace.approvedExternalTargets.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div className="um-muted" style={{ marginBottom: 6 }}>
                {t('rules.activeApprovedTitle', {
                  count: data.workspace.approvedExternalTargets.length,
                })}
              </div>
              <div className="um-list">
                {data.workspace.approvedExternalTargets.map((item) => (
                  <div
                    className="um-item"
                    key={`${item.kind}-${item.sourceDisplayPath}-${item.resolvedTarget}`}
                  >
                    <div className="um-row-between">
                      <div className="um-row">
                        <span className="um-badge success">
                          {formatApprovalSourceLabel(item.approvedBy)}
                        </span>
                        <span className="um-badge info">{formatKindLabel(item.kind)}</span>
                        <span className="um-mono">{item.sourceDisplayPath}</span>
                      </div>
                      <button
                        type="button"
                        className="um-btn sm danger"
                        disabled={savingTrust}
                        onClick={() =>
                          void updateExternalTrust(
                            data.workspace!.workspaceRoot,
                            'deny',
                            item.resolvedTarget,
                          )
                        }
                      >
                        {t('rules.blockTarget')}
                      </button>
                    </div>
                    <div className="um-mono um-muted" style={{ marginTop: 4 }}>
                      {t('rules.targetPrefix', { target: item.resolvedTarget })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(data.workspaceExternalTrust.allowPaths.length > 0 ||
            data.workspaceExternalTrust.denyPaths.length > 0) && (
            <div style={{ marginBottom: 10 }}>
              <div className="um-row-between" style={{ marginBottom: 6 }}>
                <span className="um-muted">{t('rules.savedOverridesTitle')}</span>
                <button
                  type="button"
                  className="um-btn sm"
                  disabled={savingTrust}
                  onClick={() =>
                    void updateExternalTrust(data.workspace!.workspaceRoot, 'clear_workspace')
                  }
                >
                  {t('rules.clearAllOverrides')}
                </button>
              </div>
              <div className="um-list">
                {data.workspaceExternalTrust.allowPaths.map((p) => (
                  <div className="um-item um-row-between" key={`allow-${p}`}>
                    <div className="um-row">
                      <span className="um-badge success">{t('rules.allowBadge')}</span>
                      <span className="um-mono">{p}</span>
                    </div>
                    <button
                      type="button"
                      className="um-btn sm"
                      disabled={savingTrust}
                      onClick={() =>
                        void updateExternalTrust(data.workspace!.workspaceRoot, 'revoke', p)
                      }
                    >
                      {t('rules.revokeTarget')}
                    </button>
                  </div>
                ))}
                {data.workspaceExternalTrust.denyPaths.map((p) => (
                  <div className="um-item um-row-between" key={`deny-${p}`}>
                    <div className="um-row">
                      <span className="um-badge danger">{t('rules.denyBadge')}</span>
                      <span className="um-mono">{p}</span>
                    </div>
                    <button
                      type="button"
                      className="um-btn sm"
                      disabled={savingTrust}
                      onClick={() =>
                        void updateExternalTrust(data.workspace!.workspaceRoot, 'revoke', p)
                      }
                    >
                      {t('rules.revokeTarget')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="um-row">
            <input
              className="um-input"
              style={{ flex: 1, minWidth: 200 }}
              value={manualTrustPath}
              onChange={(e) => setManualTrustPath(e.target.value)}
              placeholder={t('rules.manualPlaceholder')}
            />
            <button
              type="button"
              className="um-btn sm primary"
              disabled={savingTrust || !manualTrustPath.trim()}
              onClick={async () => {
                const target = manualTrustPath.trim();
                if (!target) return;
                await updateExternalTrust(data.workspace!.workspaceRoot, 'allow', target);
                setManualTrustPath('');
              }}
            >
              {t('rules.allowPathBtn')}
            </button>
            <button
              type="button"
              className="um-btn sm"
              disabled={savingTrust || !manualTrustPath.trim()}
              onClick={async () => {
                const target = manualTrustPath.trim();
                if (!target) return;
                await updateExternalTrust(data.workspace!.workspaceRoot, 'deny', target);
                setManualTrustPath('');
              }}
            >
              {t('rules.denyPathBtn')}
            </button>
          </div>
        </div>
      )}

      {/* Workspace Rules */}
      {data?.workspace && (
        <div className="um-card um-section">
          <div className="um-card-header">
            <h3 className="um-card-title">
              {t('rules.workspaceTitle', {
                alwaysOn: data.workspace.alwaysOn.length,
                conditional: data.workspace.conditional.length,
              })}
            </h3>
            <span className="um-mono um-muted">{data.workspace.workspaceRoot}</span>
          </div>

          {data.workspace.alwaysOn.length + data.workspace.conditional.length === 0 ? (
            <div className="um-empty">{t('rules.workspaceEmpty')}</div>
          ) : (
            <div className="um-list">
              {data.workspace.alwaysOn.map(renderRuleCard)}
              {data.workspace.conditional.map(renderRuleCard)}
            </div>
          )}

          {data.workspace.excludedPaths.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="um-muted" style={{ marginBottom: 4 }}>
                {t('rules.excludedTitle')}
              </div>
              <div className="um-row">
                {data.workspace.excludedPaths.map((p) => (
                  <span className="um-badge danger um-mono" key={p}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Dynamic Lazy-Load Hits */}
      {data && (
        <div className="um-card um-section">
          <div className="um-card-header">
            <h3 className="um-card-title">
              {t('rules.lazyHitsTitle', { count: data.recentSessionHits.length })}
            </h3>
            <span className="um-muted">{t('rules.lazyHitsSubtitle')}</span>
          </div>
          {data.recentSessionHits.length === 0 ? (
            <div className="um-empty">{t('rules.lazyHitsEmpty')}</div>
          ) : (
            <div className="um-list">
              {data.recentSessionHits.map((s) => (
                <div className="um-item" key={s.conversationId}>
                  <div className="um-row-between">
                    <span className="um-mono">{s.conversationId.slice(0, 14)}</span>
                    <div className="um-row">
                      {s.hostDedupedPaths.length > 0 && (
                        <span className="um-badge">
                          {t('overview.sessionDeduped', { count: s.hostDedupedPaths.length })}
                        </span>
                      )}
                      {s.compactionCount > 0 && (
                        <span className="um-badge warn">
                          {t('overview.sessionCompactions', { count: s.compactionCount })}
                        </span>
                      )}
                      <span className="um-muted">
                        {s.updatedAt.slice(0, 19).replace('T', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="um-row" style={{ marginTop: 6 }}>
                    {s.loadedRuleKeys.map((k) => (
                      <span className="um-badge info um-mono" key={k}>
                        {t('rules.hitRulePrefix', { key: k })}
                      </span>
                    ))}
                    {s.loadedSubdirPaths.map((k) => (
                      <span className="um-badge success um-mono" key={k}>
                        {t('rules.hitSubdirPrefix', { key: k })}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
