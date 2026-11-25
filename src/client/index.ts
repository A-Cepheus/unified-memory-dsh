import type { Context } from '@deepseek-ai/cordis';
import { PLUGIN_ID } from '../shared/api-contract.js';
import { SessionContextTab, SessionContextTitle } from './components/SessionContextTab.js';
import { UnifiedMemoryConsole } from './components/UnifiedMemoryConsole.js';
import type { DshClientContext } from './dsh-types.js';
import { CLIENT_LOCALE_DICTS, CLIENT_LOCALE_NS, en, zh } from './i18n.js';
import { MemoryGuideIcon, MemoryPanelIcon } from './icons.js';
import { CLIENT_PLUGIN_ID, CLIENT_STYLES_CSS, CLIENT_STYLE_ID } from './styles.js';

export const NS = CLIENT_LOCALE_NS;
export const PANEL_ID = 'unified-memory';
export const RIGHT_TAB_ID = PLUGIN_ID;
export const RIGHT_TAB_KIND = 'unified-memory';

export { CLIENT_LOCALE_DICTS, en, zh };

/**
 * Required Cordis client services for the Left Sidebar Global Console.
 * Right Sidebar (`sidebarRightTabs`) is mounted optionally via `ctx.inject`
 * so the Global Console still activates cleanly even if the right sidebar
 * package is omitted in a custom composition.
 */
export const inject = ['slots', 'locale', 'layout'];

function installScopedStyles(ctx: Context): void {
  if (typeof document === 'undefined') return;
  ctx.effect(() => {
    const existing = document.querySelector<HTMLStyleElement>(
      `style[data-plugin-css=${JSON.stringify(CLIENT_STYLE_ID)}]`,
    );
    if (existing) {
      existing.textContent = CLIENT_STYLES_CSS;
      return () => {
        existing.remove();
      };
    }
    const tag = document.createElement('style');
    tag.dataset.plugin = CLIENT_PLUGIN_ID;
    tag.dataset.pluginCss = CLIENT_STYLE_ID;
    tag.textContent = CLIENT_STYLES_CSS;
    document.head.appendChild(tag);
    return () => {
      tag.remove();
    };
  }, 'unified-memory: scoped stylesheet');
}

/**
 * Browser & Desktop client plugin entry point for `unified-memory-dsh`.
 */
export function apply(rawCtx: Context): void {
  const ctx = rawCtx as DshClientContext;

  installScopedStyles(ctx);

  // Register full bilingual translations (both 'zh' and 'en' required by DSH).
  ctx.effect(
    () => ctx.locale.register(NS, { zh, en }),
    'unified-memory: bilingual client dictionaries',
  );
  const t = ctx.locale.bind(NS);

  // 1. Left Sidebar Global Console (`sidebar.panellist` + `main` keyed slot).
  ctx.effect(
    () =>
      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: PANEL_ID,
            locale: NS,
            inject: () => ({
              getActiveLocale: () => ctx.locale.getLocale().active,
            }),
          },
          UnifiedMemoryConsole,
        ),
      ),
    'unified-memory: main console panel',
  );

  ctx.effect(
    () =>
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 20,
            label: () => t('panel.navLabel'),
            locale: NS,
          },
          MemoryPanelIcon,
        ),
      ),
    'unified-memory: left sidebar navigation entry',
  );

  // 2. Right Sidebar Per-Session Context Tab (`sidebarRightTabs` + `sidebar.right.pane.tab`).
  ctx.inject(['sidebarRightTabs'], (rawScope) => {
    const scope = rawScope as DshClientContext;
    const registry = scope.sidebarRightTabs;
    if (!registry) return;

    scope.effect(
      () =>
        registry.register({
          id: RIGHT_TAB_ID,
          kind: RIGHT_TAB_KIND,
          priority: 'extension',
          title: () => t('rightTab.title'),
          guide: [
            {
              id: 'memory-context',
              order: 40,
              title: () => t('rightTab.guideTitle'),
              description: () => t('rightTab.guideDescription'),
              icon: MemoryGuideIcon,
            },
          ],
        }),
      'unified-memory: right sidebar tab type',
    );

    scope.effect(
      () =>
        scope.slots.inject('sidebar.right.pane.tab', () =>
          scope.slots.register(
            {
              name: 'sidebar.right.pane.tab',
              key: RIGHT_TAB_ID,
              locale: NS,
              inject: () => ({
                openGlobalConsole: () => {
                  ctx.layout.selectPanel(PANEL_ID);
                },
              }),
            },
            SessionContextTab,
          ),
        ),
      'unified-memory: right sidebar tab body',
    );

    scope.effect(
      () =>
        scope.slots.inject('sidebar.right.pane.tab.title', () =>
          scope.slots.register(
            {
              name: 'sidebar.right.pane.tab.title',
              key: RIGHT_TAB_ID,
              locale: NS,
            },
            SessionContextTitle,
          ),
        ),
      'unified-memory: right sidebar tab title',
    );
  });
}
