export const CLIENT_PLUGIN_ID = 'unified-memory-dsh';
export const CLIENT_STYLE_ID = 'unified-memory-dsh/styles.css';

/**
 * Scoped stylesheet built exclusively on DSH's `--dsw-*` design tokens and
 * `body[data-ds-dark-theme]` dark mode. Every selector is scoped under
 * `.um-dsh-console`, `.um-dsh-right-tab`, or `.um-dsh-modal-backdrop` so zero
 * global styles leak into the host DSH application.
 */
export const CLIENT_STYLES_CSS = `
.um-dsh-console,
.um-dsh-right-tab,
.um-dsh-modal-backdrop {
  --um-bg: var(--dsw-alias-bg-base, #ffffff);
  --um-bg-card: var(--dsw-alias-card-fill, #fafafa);
  --um-bg-layer: var(--dsw-alias-bg-layer-1, #ffffff);
  --um-bg-hover: var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, 0.06));
  --um-bg-code: var(--dsw-alias-markdown-code-block, #f5f7fa);
  --um-text: var(--dsw-alias-label-primary, #0f1115);
  --um-text-2: var(--dsw-alias-label-secondary, #61666b);
  --um-text-3: var(--dsw-alias-label-tertiary, #81858c);
  --um-border: var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.12));
  --um-border-subtle: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));
  --um-border-strong: var(--dsw-alias-border-l4, rgba(0, 0, 0, 0.16));
  --um-accent: var(--dsw-alias-state-business-primary, #4176e6);
  --um-accent-bg: var(--dsw-alias-state-business-tertiary, #e4edfd);
  --um-btn-primary-bg: var(--dsw-alias-button-primary-fill, #0f1115);
  --um-btn-primary-hover: var(--dsw-alias-button-primary-hover, #43454a);
  --um-btn-primary-fg: var(--dsw-alias-label-primary-foreground, #ffffff);
  --um-success-bg: var(--dsw-alias-state-success-tertiary, #e6faed);
  --um-success-fg: #15803d;
  --um-warn-bg: var(--dsw-alias-state-warn-tertiary, #fef5e7);
  --um-warn-fg: var(--dsw-alias-state-warn-label, #b45309);
  --um-danger-bg: var(--dsw-alias-code-diff-deleted, rgba(236, 19, 19, 0.09));
  --um-danger-fg: var(--dsw-alias-state-error-primary, #dc2626);
  --um-font: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif);
  --um-mono: var(--ds-font-family-code, "SF Mono", Menlo, Consolas, "PingFang SC", "Microsoft YaHei");
  --um-radius-sm: var(--dsw-radius-sm, 8px);
  --um-radius-md: var(--dsw-radius-md, 12px);
  --um-radius-xs: var(--dsw-radius-xs, 4px);
  font-family: var(--um-font);
  color: var(--um-text);
  font-size: 13px;
  line-height: 1.5;
  box-sizing: border-box;
}

body[data-ds-dark-theme] .um-dsh-console,
body[data-ds-dark-theme] .um-dsh-right-tab,
body[data-ds-dark-theme] .um-dsh-modal-backdrop {
  --um-success-fg: var(--dsw-alias-state-success-secondary, #4ed17e);
  --um-warn-fg: var(--dsw-alias-state-warn-secondary, #f7ad31);
  --um-danger-fg: var(--dsw-alias-state-error-primary, #f25a5a);
}

.um-dsh-console *,
.um-dsh-right-tab *,
.um-dsh-modal-backdrop * {
  box-sizing: border-box;
}

/* Main Left-Sidebar Console layout */
.um-dsh-console {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  width: 100%;
  background: var(--um-bg);
  overflow: hidden;
}

.um-dsh-console-header {
  flex: none;
  border-bottom: 1px solid var(--um-border-subtle);
  background: var(--um-bg);
  padding: 18px clamp(20px, 3.5vw, 40px) 0;
  padding-inline-start: max(clamp(20px, 3.5vw, 40px), calc(var(--dsh-frame-leading-clearance, 0px) + 12px));
}

.um-dsh-console-header-inner {
  max-width: 1040px;
  margin: 0 auto;
  width: 100%;
}

.um-dsh-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.um-dsh-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.um-dsh-brand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--um-radius-sm);
  background: var(--um-accent-bg);
  color: var(--um-accent);
  flex-shrink: 0;
}

.um-dsh-title-group {
  min-width: 0;
}

.um-dsh-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.um-dsh-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--um-text);
}

.um-dsh-subtitle {
  margin: 1px 0 0;
  font-size: 12px;
  color: var(--um-text-3);
}

.um-dsh-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.um-dsh-tab {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--um-text-2);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 12px 10px;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.12s ease, border-color 0.12s ease;
}

.um-dsh-tab:hover {
  color: var(--um-text);
}

.um-dsh-tab.active {
  color: var(--um-accent);
  border-bottom-color: var(--um-accent);
  font-weight: 600;
}

.um-dsh-console-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 18px clamp(20px, 3.5vw, 40px) 40px;
}

.um-dsh-console-inner {
  max-width: 1040px;
  margin: 0 auto;
  width: 100%;
}

/* Shared cards, grids, controls */
.um-grid-2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.um-section + .um-section,
.um-card + .um-card {
  margin-top: 12px;
}

.um-card {
  background: var(--um-bg-card);
  border: 1px solid var(--um-border-subtle);
  border-radius: var(--um-radius-md);
  padding: 14px 16px;
}

.um-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.um-card-title {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--um-text);
}

.um-muted {
  color: var(--um-text-2);
  font-size: 12px;
}

.um-caption {
  color: var(--um-text-3);
  font-size: 11.5px;
}

.um-mono {
  font-family: var(--um-mono);
  font-size: 11.5px;
  word-break: break-all;
}

.um-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.um-row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.um-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  background: var(--um-bg-hover);
  color: var(--um-text-2);
  max-width: 100%;
}

.um-badge.info {
  background: var(--um-accent-bg);
  color: var(--um-accent);
}

.um-badge.success {
  background: var(--um-success-bg);
  color: var(--um-success-fg);
}

.um-badge.warn {
  background: var(--um-warn-bg);
  color: var(--um-warn-fg);
}

.um-badge.danger {
  background: var(--um-danger-bg);
  color: var(--um-danger-fg);
}

.um-btn {
  appearance: none;
  border: 1px solid var(--um-border);
  background: var(--um-bg-layer);
  color: var(--um-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 11px;
  border-radius: var(--um-radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  transition: background-color 0.12s ease, border-color 0.12s ease, opacity 0.12s ease;
}

.um-btn:hover:not(:disabled) {
  background: var(--um-bg-hover);
  border-color: var(--um-border-strong);
}

.um-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.um-btn.primary {
  background: var(--um-btn-primary-bg);
  border-color: var(--um-btn-primary-bg);
  color: var(--um-btn-primary-fg);
}

.um-btn.primary:hover:not(:disabled) {
  background: var(--um-btn-primary-hover);
  border-color: var(--um-btn-primary-hover);
}

.um-btn.accent {
  background: var(--um-accent);
  border-color: var(--um-accent);
  color: #ffffff;
}

.um-btn.accent:hover:not(:disabled) {
  filter: brightness(1.06);
}

.um-btn.danger {
  color: var(--um-danger-fg);
  border-color: transparent;
  background: var(--um-danger-bg);
}

.um-btn.danger:hover:not(:disabled) {
  filter: brightness(0.96);
}

.um-btn.sm {
  padding: 3px 8px;
  font-size: 11.5px;
}

.um-input,
.um-select,
.um-textarea {
  width: 100%;
  background: var(--um-bg-layer);
  color: var(--um-text);
  border: 1px solid var(--um-border);
  border-radius: var(--um-radius-sm);
  padding: 6px 10px;
  font-family: inherit;
  font-size: 12.5px;
  transition: border-color 0.12s ease;
}

.um-textarea {
  font-family: var(--um-mono);
  font-size: 12px;
  resize: vertical;
  min-height: 140px;
}

.um-input:focus,
.um-select:focus,
.um-textarea:focus {
  outline: none;
  border-color: var(--um-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--um-accent) 22%, transparent);
}

.um-pill-bar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.um-pill {
  appearance: none;
  border: 1px solid var(--um-border-subtle);
  background: var(--um-bg-layer);
  color: var(--um-text-2);
  border-radius: 999px;
  padding: 3px 10px;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.um-pill:hover {
  color: var(--um-text);
  background: var(--um-bg-hover);
}

.um-pill.active {
  background: var(--um-accent-bg);
  color: var(--um-accent);
  border-color: transparent;
  font-weight: 600;
}

.um-progress-track {
  width: 100%;
  height: 7px;
  background: var(--um-bg-hover);
  border-radius: 999px;
  overflow: hidden;
  margin-top: 4px;
}

.um-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--um-accent);
  transition: width 0.2s ease;
}

.um-progress-fill.warn {
  background: var(--dsw-alias-state-warn-primary, #f59e0b);
}

.um-progress-fill.danger {
  background: var(--um-danger-fg);
}

.um-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.um-item {
  background: var(--um-bg-layer);
  border: 1px solid var(--um-border-subtle);
  border-radius: var(--um-radius-sm);
  padding: 10px 12px;
}

.um-item-hover {
  cursor: pointer;
  transition: border-color 0.12s ease, background-color 0.12s ease;
}

.um-item-hover:hover {
  border-color: var(--um-accent);
}

.um-pre {
  margin: 8px 0 0;
  padding: 10px 12px;
  background: var(--um-bg-code);
  border: 1px solid var(--um-border-subtle);
  border-radius: var(--um-radius-sm);
  font-family: var(--um-mono);
  font-size: 11.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 420px;
  overflow: auto;
  color: var(--um-text);
}

.um-banner {
  padding: 9px 12px;
  border-radius: var(--um-radius-sm);
  font-size: 12px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.um-banner.info {
  background: var(--um-accent-bg);
  color: var(--um-accent);
}

.um-banner.warn {
  background: var(--um-warn-bg);
  color: var(--um-warn-fg);
}

.um-banner.danger {
  background: var(--um-danger-bg);
  color: var(--um-danger-fg);
}

.um-banner.success {
  background: var(--um-success-bg);
  color: var(--um-success-fg);
}

.um-kv {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 5px 10px;
  font-size: 12px;
  align-items: baseline;
}

.um-kv-key {
  color: var(--um-text-3);
}

.um-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 0;
  border-bottom: 1px solid var(--um-border-subtle);
}

.um-toggle:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.um-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--um-accent);
  cursor: pointer;
  flex-shrink: 0;
}

.um-field {
  margin-bottom: 11px;
}

.um-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--um-text-2);
}

.um-empty {
  text-align: center;
  padding: 22px 12px;
  color: var(--um-text-3);
  font-size: 12.5px;
}

/* Modal */
.um-dsh-modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--dsw-alias-bg-mask-3, rgba(0, 0, 0, 0.48));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 200;
}

.um-dsh-modal {
  background: var(--um-bg-layer);
  border: 1px solid var(--um-border);
  border-radius: var(--um-radius-md);
  width: 100%;
  max-width: 660px;
  max-height: 90vh;
  overflow: auto;
  padding: 18px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.24);
}

/* Right Sidebar Per-Session Tab */
.um-dsh-right-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  background: var(--um-bg);
}

.um-dsh-right-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  height: 38px;
  flex: none;
  padding: 0 10px 0 12px;
  border-bottom: 1px solid var(--um-border-subtle);
}

.um-dsh-right-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--um-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.um-dsh-right-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.um-dsh-right-card {
  background: var(--um-bg-card);
  border: 1px solid var(--um-border-subtle);
  border-radius: var(--um-radius-sm);
  padding: 10px 11px;
}

.um-dsh-right-section-title {
  margin: 0 0 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--um-text-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.um-dsh-right-kv {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 4px 8px;
  font-size: 11.5px;
  align-items: baseline;
}

.um-dsh-chip-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.um-dsh-chip-row {
  background: var(--um-bg-layer);
  border: 1px solid var(--um-border-subtle);
  border-radius: var(--um-radius-xs);
  padding: 5px 8px;
  font-size: 11.5px;
}

.um-dsh-tab-title-icon {
  flex: none;
  vertical-align: middle;
}

@media (max-width: 640px) {
  .um-kv {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  .um-dsh-console-header {
    padding: 14px 14px 0;
  }
  .um-dsh-console-body {
    padding: 14px 14px 32px;
  }
}
`;
