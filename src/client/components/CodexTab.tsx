import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import type {
  CodexBrowseResponse,
  CodexReadResponse,
  CodexSearchHit,
} from '../../shared/api-contract.js';
import { unifiedMemoryApi } from '../api.js';
import type { ClientTranslateFn } from '../dsh-types.js';
import type { NotifyTone } from './OverviewTab.js';

interface CodexTabProps {
  readonly defaultProjectHint?: string;
  readonly t: ClientTranslateFn;
  readonly onNotify: (msg: string, tone?: NotifyTone) => void;
}

const FILE_CATEGORIES = ['all', 'summary', 'handbook', 'extension', 'rollout', 'skill'] as const;

function fmtBytes(b: number): string {
  return b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`;
}

export function CodexTab({ defaultProjectHint, t, onNotify }: CodexTabProps): ReactElement {
  const [generation, setGeneration] = useState<'auto' | 'v2' | 'v1'>('auto');
  const [subView, setSubView] = useState<'summary' | 'files' | 'search'>('summary');
  const [categoryFilter, setCategoryFilter] = useState<(typeof FILE_CATEGORIES)[number]>('all');
  const [query, setQuery] = useState('');
  const [projectHint, setProjectHint] = useState(defaultProjectHint ?? '');
  const [browseData, setBrowseData] = useState<CodexBrowseResponse | null>(null);
  const [hits, setHits] = useState<CodexSearchHit[]>([]);
  const [openedFile, setOpenedFile] = useState<CodexReadResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const loadBrowse = useCallback(
    async (gen: 'auto' | 'v2' | 'v1') => {
      setLoading(true);
      try {
        const res = await unifiedMemoryApi.browseCodex(gen);
        setBrowseData(res);
      } catch (err) {
        onNotify(err instanceof Error ? err.message : t('common.unknownError'), 'danger');
      } finally {
        setLoading(false);
      }
    },
    [onNotify, t],
  );

  useEffect(() => {
    void loadBrowse(generation);
  }, [generation, loadBrowse]);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setSubView('search');
    setSearching(true);
    try {
      const res = await unifiedMemoryApi.searchCodex({
        query: trimmed,
        projectHint: projectHint.trim() || undefined,
        generation: generation === 'auto' ? 'both' : generation,
      });
      setHits(res.hits);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t('common.unknownError'), 'danger');
    } finally {
      setSearching(false);
    }
  };

  const openFile = async (gen: 'v2' | 'v1', relativePath: string) => {
    setLoading(true);
    try {
      const res = await unifiedMemoryApi.readCodexFile({
        generation: gen,
        relativePath,
      });
      setOpenedFile(res);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t('common.unknownError'), 'danger');
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = useMemo(() => {
    if (!browseData) return [];
    if (categoryFilter === 'all') return browseData.files;
    return browseData.files.filter((f) => f.category === categoryFilter);
  }, [browseData, categoryFilter]);

  return (
    <div>
      <div className="um-banner info">
        <span>
          <strong>{t('codex.roBannerTitle')}</strong> {t('codex.roBannerBody')}
        </span>
      </div>

      {/* Controls & Search */}
      <div className="um-card um-section">
        <div className="um-row-between" style={{ marginBottom: 10 }}>
          <div className="um-pill-bar">
            {(['auto', 'v2', 'v1'] as const).map((g) => (
              <button
                key={g}
                type="button"
                className={`um-pill ${generation === g ? 'active' : ''}`}
                onClick={() => setGeneration(g)}
              >
                {g === 'auto'
                  ? t('codex.genAuto', { gen: browseData?.status.activeGeneration ?? '...' })
                  : g === 'v2'
                    ? `${t('codex.genV2')}${browseData?.status.v2.exists ? '' : t('codex.absent')}`
                    : `${t('codex.genV1')}${browseData?.status.v1.exists ? '' : t('codex.absent')}`}
              </button>
            ))}
          </div>

          <div className="um-pill-bar">
            <button
              type="button"
              className={`um-pill ${subView === 'summary' ? 'active' : ''}`}
              onClick={() => setSubView('summary')}
            >
              {t('codex.viewSummary')}
            </button>
            <button
              type="button"
              className={`um-pill ${subView === 'files' ? 'active' : ''}`}
              onClick={() => setSubView('files')}
            >
              {t('codex.viewFiles', { count: browseData?.files.length ?? 0 })}
            </button>
            <button
              type="button"
              className={`um-pill ${subView === 'search' ? 'active' : ''}`}
              onClick={() => setSubView('search')}
            >
              {t('codex.viewSearch', { count: hits.length })}
            </button>
          </div>
        </div>

        <form className="um-row" onSubmit={(e) => void handleSearch(e)}>
          <input
            className="um-input"
            style={{ flex: 2, minWidth: 160 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('codex.searchPlaceholder')}
          />
          <input
            className="um-input"
            style={{ flex: 1, minWidth: 120 }}
            value={projectHint}
            onChange={(e) => setProjectHint(e.target.value)}
            placeholder={t('codex.projectBoostPlaceholder')}
          />
          <button
            type="submit"
            className="um-btn primary"
            disabled={searching || !query.trim()}
          >
            {searching ? t('codex.searching') : t('codex.searchBtn')}
          </button>
        </form>
      </div>

      {/* Inline Read-Only File Viewer */}
      {openedFile && (
        <div className="um-card um-section">
          <div className="um-card-header">
            <div className="um-row">
              <span className="um-badge info">{openedFile.generation}</span>
              <span className="um-mono">{openedFile.relativePath}</span>
              <span className="um-muted">{fmtBytes(openedFile.sizeBytes)}</span>
              {openedFile.truncated && (
                <span className="um-badge warn">{t('codex.truncated')}</span>
              )}
            </div>
            <button
              type="button"
              className="um-btn sm"
              onClick={() => setOpenedFile(null)}
            >
              {t('codex.closeViewer')}
            </button>
          </div>
          <pre className="um-pre">{openedFile.content}</pre>
        </div>
      )}

      {/* Subview: Summary */}
      {subView === 'summary' && browseData && (
        <div className="um-card um-section">
          <div className="um-card-header">
            <div className="um-row">
              <h3 className="um-card-title">memory_summary.md</h3>
              <span className="um-badge success">{browseData.summary.generation}</span>
              <span className="um-muted">{fmtBytes(browseData.summary.totalBytes)}</span>
            </div>
            <button
              type="button"
              className="um-btn sm"
              onClick={() => void loadBrowse(generation)}
              disabled={loading}
            >
              {t('common.refresh')}
            </button>
          </div>
          {browseData.summary.content ? (
            <pre className="um-pre" style={{ maxHeight: 480 }}>
              {browseData.summary.content}
            </pre>
          ) : (
            <div className="um-empty">{t('codex.noSummary')}</div>
          )}
        </div>
      )}

      {/* Subview: Directory Files Browser */}
      {subView === 'files' && browseData && (
        <div className="um-card um-section">
          <div className="um-card-header">
            <h3 className="um-card-title">
              {t('codex.filesTitle', {
                dir: browseData.selectedGeneration === 'v2' ? 'memories_v2' : 'memories',
                count: filteredFiles.length,
              })}
            </h3>
            <div className="um-pill-bar">
              {FILE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`um-pill ${categoryFilter === cat ? 'active' : ''}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat === 'all' ? t('claude.filterAll') : t(`codex.cat.${cat}`)}
                </button>
              ))}
            </div>
          </div>
          {filteredFiles.length === 0 ? (
            <div className="um-empty">{t('codex.noFiles')}</div>
          ) : (
            <div className="um-list">
              {filteredFiles.map((f) => (
                <div
                  key={f.relativePath}
                  className="um-item um-item-hover"
                  onClick={() => void openFile(browseData.selectedGeneration, f.relativePath)}
                >
                  <div className="um-row-between">
                    <div className="um-row">
                      <span className="um-badge info">{t(`codex.cat.${f.category}`)}</span>
                      <span className="um-mono">{f.relativePath}</span>
                    </div>
                    <span className="um-muted">{fmtBytes(f.sizeBytes)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subview: Search Hits */}
      {subView === 'search' && (
        <div className="um-card um-section">
          <div className="um-card-header">
            <h3 className="um-card-title">
              {t('codex.searchResultsTitle', { count: hits.length })}
            </h3>
          </div>
          {hits.length === 0 ? (
            <div className="um-empty">{t('codex.searchEmpty')}</div>
          ) : (
            <div className="um-list">
              {hits.map((hit, i) => (
                <div
                  key={`${hit.generation}-${hit.relativePath}-${i}`}
                  className="um-item um-item-hover"
                  onClick={() => void openFile(hit.generation, hit.relativePath)}
                >
                  <div className="um-row-between">
                    <div className="um-row">
                      <span className="um-badge success">{hit.generation}</span>
                      <span className="um-badge info">{t(`codex.cat.${hit.category}`)}</span>
                      <strong>{hit.title}</strong>
                    </div>
                    <span className="um-muted">{t('codex.score', { score: hit.score })}</span>
                  </div>
                  <div className="um-muted" style={{ marginTop: 4 }}>
                    {hit.snippet}
                  </div>
                  <div className="um-mono um-muted" style={{ marginTop: 4 }}>
                    {hit.relativePath}
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
