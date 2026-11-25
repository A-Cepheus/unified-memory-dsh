import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import type {
  ClaudeListResponse,
  ClaudeMemoryTopic,
  ClaudeMemoryType,
  ClaudeProjectSummary,
} from '../../shared/api-contract.js';
import { unifiedMemoryApi } from '../api.js';
import type { ClientTranslateFn } from '../dsh-types.js';
import type { NotifyTone } from './OverviewTab.js';

interface ClaudeTabProps {
  readonly projects: ClaudeProjectSummary[];
  readonly selectedSlug: string;
  readonly onSelectSlug: (slug: string) => void;
  readonly t: ClientTranslateFn;
  readonly onOverviewRefresh: () => Promise<void>;
  readonly onNotify: (msg: string, tone?: NotifyTone) => void;
}

const MEMORY_TYPES: readonly ClaudeMemoryType[] = ['user', 'feedback', 'project', 'reference'];

const TYPE_BADGE: Record<string, string> = {
  user: 'info',
  feedback: 'warn',
  project: 'success',
  reference: '',
};

interface TopicDraft {
  isNew: boolean;
  filename: string;
  name: string;
  description: string;
  type: ClaudeMemoryType;
  body: string;
}

function measureUtf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function ClaudeTab({
  projects,
  selectedSlug,
  onSelectSlug,
  t,
  onOverviewRefresh,
  onNotify,
}: ClaudeTabProps): ReactElement {
  const [data, setData] = useState<ClaudeListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<string | null>(null);
  const [draft, setDraft] = useState<TopicDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState(false);
  const [indexDraft, setIndexDraft] = useState('');

  const loadProject = useCallback(
    async (slug: string) => {
      if (!slug) return;
      setLoading(true);
      try {
        const res = await unifiedMemoryApi.listClaudeMemories({ slug });
        setData(res);
        setIndexDraft(res.index.content);
        setConfirmDeleteFile(null);
      } catch (err) {
        onNotify(err instanceof Error ? err.message : t('common.unknownError'), 'danger');
      } finally {
        setLoading(false);
      }
    },
    [onNotify, t],
  );

  useEffect(() => {
    if (selectedSlug) {
      void loadProject(selectedSlug);
    } else if (projects.length > 0) {
      onSelectSlug(projects[0].slug);
    }
  }, [selectedSlug, projects.length, loadProject, onSelectSlug]);

  const filteredTopics = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.topics.filter((topic) => {
      if (typeFilter !== 'all' && topic.type !== typeFilter) return false;
      if (!q) return true;
      return (
        topic.name.toLowerCase().includes(q) ||
        topic.description.toLowerCase().includes(q) ||
        topic.filename.toLowerCase().includes(q) ||
        topic.body.toLowerCase().includes(q)
      );
    });
  }, [data, typeFilter, search]);

  const handleSaveTopic = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft || !selectedSlug) return;
    setSaving(true);
    try {
      const res = await unifiedMemoryApi.saveClaudeTopic({
        slug: selectedSlug,
        filename: draft.isNew ? draft.filename.trim() || undefined : draft.filename,
        name: draft.name.trim(),
        description: draft.description.trim(),
        type: draft.type,
        body: draft.body,
      });
      setDraft(null);
      await loadProject(selectedSlug);
      await onOverviewRefresh();
      if (res.warnings.length > 0) {
        onNotify(t('claude.topicSavedWarn', { warning: res.warnings[0] }), 'warn');
      } else {
        onNotify(t('claude.topicSaved'), 'success');
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t('common.unknownError'), 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTopic = async (topic: ClaudeMemoryTopic) => {
    if (!selectedSlug) return;
    setSaving(true);
    try {
      await unifiedMemoryApi.deleteClaudeTopic({
        slug: selectedSlug,
        filename: topic.filename,
      });
      if (expandedFile === topic.filename) setExpandedFile(null);
      setConfirmDeleteFile(null);
      await loadProject(selectedSlug);
      await onOverviewRefresh();
      onNotify(t('claude.topicDeleted', { filename: topic.filename }), 'info');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t('common.unknownError'), 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveIndex = async () => {
    if (!selectedSlug) return;
    setSaving(true);
    try {
      await unifiedMemoryApi.saveClaudeIndex({
        slug: selectedSlug,
        content: indexDraft,
      });
      setEditingIndex(false);
      await loadProject(selectedSlug);
      await onOverviewRefresh();
      onNotify(t('claude.indexSaved'), 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t('common.unknownError'), 'danger');
    } finally {
      setSaving(false);
    }
  };

  const effectiveLines = editingIndex
    ? indexDraft === ''
      ? 0
      : indexDraft.split(/\r?\n/).length
    : (data?.index.totalLines ?? 0);
  const effectiveBytes = editingIndex
    ? measureUtf8Bytes(indexDraft)
    : (data?.index.totalBytes ?? 0);
  const maxLines = data?.index.maxLines ?? 200;
  const maxBytes = data?.index.maxBytes ?? 25 * 1024;

  const linePct = Math.min(100, (effectiveLines / maxLines) * 100);
  const bytePct = Math.min(100, (effectiveBytes / maxBytes) * 100);
  const lineTone = linePct >= 95 ? 'danger' : linePct >= 80 ? 'warn' : '';
  const byteTone = bytePct >= 95 ? 'danger' : bytePct >= 80 ? 'warn' : '';
  const isOverCap =
    (editingIndex ? effectiveLines > maxLines || effectiveBytes > maxBytes : data?.index.truncated) ??
    false;

  const hasSelectedInProjects =
    selectedSlug !== '' && projects.some((p) => p.slug === selectedSlug);

  return (
    <div>
      {/* Project Selector */}
      <div className="um-card um-section">
        <div className="um-row">
          <select
            className="um-select"
            style={{ flex: 1, minWidth: 200 }}
            value={selectedSlug}
            onChange={(e) => onSelectSlug(e.target.value)}
          >
            {projects.length === 0 && !selectedSlug && (
              <option value="">{t('claude.noProjects')}</option>
            )}
            {selectedSlug && !hasSelectedInProjects && (
              <option value={selectedSlug}>
                {t('claude.projectOptionNew', {
                  path: data?.slug === selectedSlug && data.resolvedRoot ? data.resolvedRoot : selectedSlug,
                })}
              </option>
            )}
            {projects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {t('claude.projectOption', { path: p.displayPath, count: p.topicCount })}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="um-btn"
            onClick={() => selectedSlug && void loadProject(selectedSlug)}
            disabled={loading || !selectedSlug}
          >
            {t('common.refresh')}
          </button>
          <button
            type="button"
            className="um-btn primary"
            disabled={!selectedSlug}
            onClick={() =>
              setDraft({
                isNew: true,
                filename: '',
                name: '',
                description: '',
                type: 'project',
                body: '',
              })
            }
          >
            {t('claude.newTopic')}
          </button>
        </div>
        {data && (
          <div className="um-muted um-mono" style={{ marginTop: 6 }}>
            {data.memoryDir}
          </div>
        )}
      </div>

      {data && !data.autoMemoryEnabled && (
        <div className="um-banner warn">{t('claude.autoMemoryDisabled')}</div>
      )}

      {/* MEMORY.md Index Budget & Editor */}
      {data && (
        <div className="um-card um-section">
          <div className="um-card-header">
            <div className="um-row">
              <h3 className="um-card-title">{t('claude.indexTitle')}</h3>
              {isOverCap ? (
                <span className="um-badge danger">
                  {t('claude.indexTruncated', {
                    lines: maxLines,
                    kb: (maxBytes / 1024).toFixed(0),
                  })}
                </span>
              ) : (
                <span className="um-badge success">{t('claude.indexWithinCap')}</span>
              )}
            </div>
            <button
              type="button"
              className="um-btn sm"
              onClick={() => {
                if (!editingIndex) setIndexDraft(data.index.content);
                setEditingIndex((v) => !v);
              }}
            >
              {editingIndex ? t('claude.closeEditor') : t('claude.editIndex')}
            </button>
          </div>

          <div className="um-grid-2">
            <div>
              <div className="um-row-between um-muted">
                <span>{t('claude.linesLabel')}</span>
                <span className="um-mono">
                  {effectiveLines} / {maxLines}
                </span>
              </div>
              <div className="um-progress-track">
                <div className={`um-progress-fill ${lineTone}`} style={{ width: `${linePct}%` }} />
              </div>
            </div>
            <div>
              <div className="um-row-between um-muted">
                <span>{t('claude.sizeLabel')}</span>
                <span className="um-mono">
                  {(effectiveBytes / 1024).toFixed(1)} / {(maxBytes / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className="um-progress-track">
                <div className={`um-progress-fill ${byteTone}`} style={{ width: `${bytePct}%` }} />
              </div>
            </div>
          </div>

          {editingIndex ? (
            <div style={{ marginTop: 10 }}>
              <textarea
                className="um-textarea"
                style={{ minHeight: 200 }}
                value={indexDraft}
                onChange={(e) => setIndexDraft(e.target.value)}
              />
              <div className="um-row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="um-btn"
                  onClick={() => setEditingIndex(false)}
                  disabled={saving}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="um-btn primary"
                  onClick={() => void handleSaveIndex()}
                  disabled={saving}
                >
                  {saving ? t('common.saving') : t('claude.saveIndex')}
                </button>
              </div>
            </div>
          ) : data.index.exists && data.index.content.trim() ? (
            <pre className="um-pre" style={{ maxHeight: 190 }}>
              {data.index.content}
            </pre>
          ) : (
            <div className="um-empty" style={{ padding: '12px 0 4px' }}>
              {t('claude.noIndexYet')}
            </div>
          )}
        </div>
      )}

      {/* Topics Filter + Cards */}
      {data && (
        <div className="um-card um-section">
          <div className="um-card-header">
            <h3 className="um-card-title">
              {t('claude.topicsTitle', { count: filteredTopics.length })}
            </h3>
            <div className="um-pill-bar">
              {(['all', ...MEMORY_TYPES] as const).map((tp) => (
                <button
                  key={tp}
                  type="button"
                  className={`um-pill ${typeFilter === tp ? 'active' : ''}`}
                  onClick={() => setTypeFilter(tp)}
                >
                  {tp === 'all' ? t('claude.filterAll') : t(`claude.type.${tp}`)}
                </button>
              ))}
            </div>
          </div>

          <input
            className="um-input"
            style={{ marginBottom: 10 }}
            placeholder={t('claude.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {loading ? (
            <div className="um-empty">{t('claude.loadingProject')}</div>
          ) : filteredTopics.length === 0 ? (
            <div className="um-empty">{t('claude.noMatchingTopics')}</div>
          ) : (
            <div className="um-list">
              {filteredTopics.map((topic) => {
                const isExpanded = expandedFile === topic.filename;
                const isConfirmingDelete = confirmDeleteFile === topic.filename;
                return (
                  <div className="um-item" key={topic.filename}>
                    <div className="um-row-between">
                      <div className="um-row">
                        <strong>{topic.name}</strong>
                        <span className={`um-badge ${TYPE_BADGE[topic.type] ?? ''}`}>
                          {topic.type}
                        </span>
                        <span className="um-badge">
                          {topic.schema === 'nested_metadata'
                            ? t('claude.schemaNested')
                            : topic.schema === 'flat'
                              ? t('claude.schemaFlat')
                              : t('claude.schemaNone')}
                        </span>
                      </div>
                      <div className="um-row">
                        <button
                          type="button"
                          className="um-btn sm"
                          onClick={() => setExpandedFile(isExpanded ? null : topic.filename)}
                        >
                          {isExpanded ? t('common.hide') : t('common.read')}
                        </button>
                        <button
                          type="button"
                          className="um-btn sm"
                          onClick={() =>
                            setDraft({
                              isNew: false,
                              filename: topic.filename,
                              name: topic.name,
                              description: topic.description,
                              type: (MEMORY_TYPES.includes(topic.type as ClaudeMemoryType)
                                ? topic.type
                                : 'project') as ClaudeMemoryType,
                              body: topic.body,
                            })
                          }
                        >
                          {t('common.edit')}
                        </button>
                        {isConfirmingDelete ? (
                          <>
                            <button
                              type="button"
                              className="um-btn sm danger"
                              disabled={saving}
                              onClick={() => void handleDeleteTopic(topic)}
                            >
                              {t('common.confirmDelete')}
                            </button>
                            <button
                              type="button"
                              className="um-btn sm"
                              disabled={saving}
                              onClick={() => setConfirmDeleteFile(null)}
                            >
                              {t('common.cancel')}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="um-btn sm danger"
                            onClick={() => setConfirmDeleteFile(topic.filename)}
                          >
                            {t('common.delete')}
                          </button>
                        )}
                      </div>
                    </div>

                    {topic.description && (
                      <div style={{ marginTop: 4, color: 'var(--um-text-2)' }}>
                        {topic.description}
                      </div>
                    )}

                    <div className="um-row um-muted" style={{ marginTop: 6 }}>
                      <span className="um-mono">{topic.filename}</span>
                      <span>·</span>
                      <span>{topic.sizeBytes} B</span>
                      {topic.modified && (
                        <>
                          <span>·</span>
                          <span>
                            {t('claude.modifiedAt', {
                              ts: `${topic.modified.slice(0, 19).replace('T', ' ')}Z`,
                            })}
                          </span>
                        </>
                      )}
                    </div>

                    {isExpanded && <pre className="um-pre">{topic.body || topic.rawContent}</pre>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Topic Modal */}
      {draft && (
        <div
          className="um-dsh-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => !saving && setDraft(null)}
        >
          <div className="um-dsh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="um-card-header">
              <h3 className="um-card-title">
                {draft.isNew
                  ? t('claude.modalNewTitle')
                  : t('claude.modalEditTitle', { filename: draft.filename })}
              </h3>
              <span className="um-badge info">{t('claude.modalSchemaBadge')}</span>
            </div>

            <form onSubmit={(e) => void handleSaveTopic(e)}>
              <div className="um-field">
                <label className="um-label">{t('claude.fieldType')}</label>
                <select
                  className="um-select"
                  value={draft.type}
                  onChange={(e) =>
                    setDraft({ ...draft, type: e.target.value as ClaudeMemoryType })
                  }
                >
                  {MEMORY_TYPES.map((tp) => (
                    <option key={tp} value={tp}>
                      {tp} — {t(`claude.typeDesc.${tp}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="um-field">
                <label className="um-label">{t('claude.fieldName')}</label>
                <input
                  className="um-input"
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder={t('claude.fieldNamePlaceholder')}
                />
              </div>

              {draft.isNew && (
                <div className="um-field">
                  <label className="um-label">{t('claude.fieldFilename')}</label>
                  <input
                    className="um-input um-mono"
                    value={draft.filename}
                    onChange={(e) => setDraft({ ...draft, filename: e.target.value })}
                    placeholder={t('claude.fieldFilenamePlaceholder')}
                  />
                </div>
              )}

              <div className="um-field">
                <label className="um-label">{t('claude.fieldDescription')}</label>
                <input
                  className="um-input"
                  required
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder={t('claude.fieldDescriptionPlaceholder')}
                />
              </div>

              <div className="um-field">
                <label className="um-label">{t('claude.fieldBody')}</label>
                <textarea
                  className="um-textarea"
                  required
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  placeholder={t('claude.fieldBodyPlaceholder')}
                />
              </div>

              <div className="um-row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  type="button"
                  className="um-btn"
                  onClick={() => setDraft(null)}
                  disabled={saving}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="um-btn primary" disabled={saving}>
                  {saving ? t('common.saving') : t('claude.saveAndSync')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
