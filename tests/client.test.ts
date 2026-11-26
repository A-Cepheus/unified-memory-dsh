import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';
import {
  API_PATHS,
  API_ROUTES,
  PLUGIN_ID,
  type OverviewResponse,
  type RulesInspectResponse,
  type SessionContextResponse,
} from '../src/shared/api-contract.js';
import { ClaudeTab } from '../src/client/components/ClaudeTab.js';
import { CodexTab } from '../src/client/components/CodexTab.js';
import { OverviewTab } from '../src/client/components/OverviewTab.js';
import { RulesTab } from '../src/client/components/RulesTab.js';
import {
  SessionContextTab,
  SessionContextTitle,
} from '../src/client/components/SessionContextTab.js';
import { UnifiedMemoryConsole } from '../src/client/components/UnifiedMemoryConsole.js';
import { MemoryGuideIcon, MemoryPanelIcon } from '../src/client/icons.js';
import type {
  ClientTranslateFn,
  DshClientContext,
  DshSessionListStateLike,
  DshSidebarRightTabDefinition,
  DshSidebarRightTabInfo,
  DshSlotRegisterOptions,
} from '../src/client/dsh-types.js';
import { DEFAULT_CONFIG } from '../src/core/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');
const CLIENT_BUNDLE_PATH = path.join(PKG_ROOT, 'lib', 'client.js');
const HOST_BUNDLE_PATH = path.join(PKG_ROOT, 'lib', 'index.js');
const PKG_JSON_PATH = path.join(PKG_ROOT, 'package.json');
const PATCH_YML_PATH = path.join(PKG_ROOT, 'cordis.patch.yml');

/** Exact 11 PLATFORM_MODULES provided by @deepseek-ai/dsh-web-frontend. */
const PLATFORM_MODULES = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  'zod',
  '@tanstack/react-virtual',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]);

function resolveDshPackagePath(pkgName: string): string | null {
  const candidates: string[] = [
    path.join(PKG_ROOT, 'node_modules', pkgName),
    path.join(process.env.DSH_TEST_PKG_DIR || '/tmp/dsh-test/pkg', 'node_modules', pkgName),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
  }
  return null;
}

interface LoadedClientModule {
  NS: string;
  PANEL_ID: string;
  RIGHT_TAB_ID: string;
  RIGHT_TAB_KIND: string;
  inject: string[];
  en: Record<string, string>;
  zh: Record<string, string>;
  CLIENT_LOCALE_DICTS: { en: Record<string, string>; zh: Record<string, string> };
  apply: (ctx: unknown) => void;
  [Symbol.toStringTag]?: string;
}

function loadCompiledClientBundle(): {
  id: string;
  mod: LoadedClientModule;
  runtimeRequires: string[];
  sourceCode: string;
} {
  const sourceCode = fs.readFileSync(CLIENT_BUNDLE_PATH, 'utf8');
  let registeredId = '';
  let registeredFactory: ((req: (spec: string) => unknown) => unknown) | null = null;

  const fakeWindow = {
    __ModuleLoader__: {
      load(entry: { id: string; factory: (req: (spec: string) => unknown) => unknown }) {
        registeredId = entry.id;
        registeredFactory = entry.factory;
      },
    },
  };

  new Function('window', sourceCode)(fakeWindow);
  assert.equal(registeredId, PLUGIN_ID, 'Lazy-CJS module id must equal package name');
  if (!registeredFactory) {
    assert.fail('Lazy-CJS factory must be registered via window.__ModuleLoader__.load');
  }
  const factoryFn: (req: (spec: string) => unknown) => unknown = registeredFactory;

  const runtimeRequires: string[] = [];
  const requireStub = (spec: string): unknown => {
    runtimeRequires.push(spec);
    if (spec === 'react') return React;
    if (spec === 'react/jsx-runtime') return jsxRuntime;
    if (!PLATFORM_MODULES.has(spec)) {
      throw new Error(`Disallowed client require: ${spec}`);
    }
    return {};
  };

  const mod = factoryFn(requireStub) as LoadedClientModule;

  return { id: registeredId, mod, runtimeRequires, sourceCode };
}

function makeTranslator(dict: Record<string, string>): ClientTranslateFn {
  return (key, params) => {
    const raw = dict[key] ?? key;
    if (!params) return raw;
    return raw.replace(/\{(\w+)\}/g, (_m, name: string) =>
      params[name] === undefined || params[name] === null ? '' : String(params[name]),
    );
  };
}

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe('Client Bundle (Lazy-CJS, Platform Purity & Static Guards)', () => {
  it('loads via window.__ModuleLoader__.load with Symbol.toStringTag === "Module" and strict PLATFORM_MODULES requires', () => {
    const { id, mod, runtimeRequires, sourceCode } = loadCompiledClientBundle();
    assert.equal(id, 'unified-memory-dsh');
    assert.equal(mod[Symbol.toStringTag], 'Module');
    assert.equal(Object.prototype.toString.call(mod), '[object Module]');
    assert.equal(typeof mod.apply, 'function');
    assert.deepEqual(mod.inject, ['slots', 'locale', 'layout']);
    assert.ok(runtimeRequires.length > 0);
    for (const spec of runtimeRequires) {
      assert.ok(PLATFORM_MODULES.has(spec), `Runtime require "${spec}" is not in PLATFORM_MODULES`);
    }

    // Also statically scan all require("...") expressions in compiled lib/client.js
    const pkg = JSON.parse(fs.readFileSync(PKG_JSON_PATH, 'utf8')) as {
      dsh?: { client?: { external?: string[] } };
    };
    const allowed = new Set([...PLATFORM_MODULES, ...(pkg.dsh?.client?.external ?? [])]);
    const staticRe = /\brequire\(\s*["']([^"']+)["']\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = staticRe.exec(sourceCode)) !== null) {
      assert.ok(
        allowed.has(m[1]),
        `Static require("${m[1]}") in lib/client.js is outside PLATFORM_MODULES`,
      );
    }
  });

  it('enforces relative API_ROUTES (zero leading-slash /api/ in client fetch), zero PUT/DELETE/PATCH, and zero stdout pollution', () => {
    // 1. All API_ROUTES must be document-relative (no leading slash) and match API_PATHS
    for (const [key, route] of Object.entries(API_ROUTES)) {
      assert.ok(!route.startsWith('/'), `API_ROUTES.${key} must not start with "/": ${route}`);
      assert.equal(`/${route}`, API_PATHS[key as keyof typeof API_PATHS]);
    }

    // 2. Scan src/client/** for disallowed leading-slash '/api/' or PUT/DELETE/PATCH methods
    const clientFiles = collectSourceFiles(path.join(PKG_ROOT, 'src', 'client'));
    for (const file of clientFiles) {
      const text = fs.readFileSync(file, 'utf8');
      assert.equal(
        /['"]\/api\//.test(text),
        false,
        `Found leading-slash "/api/" in ${path.relative(PKG_ROOT, file)}`,
      );
      assert.equal(
        /\bmethod\s*:\s*['"](?:PUT|DELETE|PATCH)['"]/.test(text),
        false,
        `Found forbidden HTTP method PUT/DELETE/PATCH in ${path.relative(PKG_ROOT, file)}`,
      );
    }

    // 3. Scan compiled lib/client.js for forbidden HTTP methods in fetch calls
    const clientBundle = fs.readFileSync(CLIENT_BUNDLE_PATH, 'utf8');
    assert.equal(
      /\bmethod\s*:\s*["'](?:PUT|DELETE|PATCH)["']/.test(clientBundle),
      false,
      'lib/client.js must not issue PUT/DELETE/PATCH requests',
    );

    // 4. Stdout purity: zero console.log or process.stdout in src/** and lib/index.js
    const allSrc = collectSourceFiles(path.join(PKG_ROOT, 'src'));
    for (const file of allSrc) {
      const text = fs.readFileSync(file, 'utf8');
      assert.equal(
        /\bconsole\.log\b|\bprocess\.stdout\b/.test(text),
        false,
        `Stdout pollution found in ${path.relative(PKG_ROOT, file)}`,
      );
    }
    const hostBundle = fs.readFileSync(HOST_BUNDLE_PATH, 'utf8');
    assert.equal(
      /\bconsole\.log\b|\bprocess\.stdout\b/.test(hostBundle),
      false,
      'Stdout pollution found in compiled lib/index.js',
    );
  });
});

describe('Client i18n Parity & Locale Metadata', () => {
  it('has 100% key and {placeholder} parity between compiled client en and zh dictionaries', () => {
    const { mod } = loadCompiledClientBundle();
    const enKeys = Object.keys(mod.en).sort();
    const zhKeys = Object.keys(mod.zh).sort();

    assert.ok(enKeys.length >= 250, `Expected >=250 client locale keys, got ${enKeys.length}`);
    assert.deepEqual(enKeys, zhKeys, 'Client en and zh locale key sets must match 100%');

    const extractPlaceholders = (value: string): string[] =>
      [...value.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]).sort();

    for (const key of enKeys) {
      const enVal = mod.en[key];
      const zhVal = mod.zh[key];
      assert.ok(typeof enVal === 'string' && enVal.trim().length > 0, `Empty en value for ${key}`);
      assert.ok(typeof zhVal === 'string' && zhVal.trim().length > 0, `Empty zh value for ${key}`);
      assert.deepEqual(
        extractPlaceholders(enVal),
        extractPlaceholders(zhVal),
        `Placeholder mismatch for key "${key}": en="${enVal}" vs zh="${zhVal}"`,
      );
    }

    // Verify dedicated conditional rule status labels (regression guard)
    assert.ok('rightTab.ruleLoaded' in mod.en && 'rightTab.ruleLoaded' in mod.zh);
    assert.ok('rightTab.ruleStandby' in mod.en && 'rightTab.ruleStandby' in mod.zh);
    assert.notEqual(mod.en['rightTab.ruleLoaded'], mod.en['overview.sessionBaselineOn']);
    assert.notEqual(mod.zh['rightTab.ruleLoaded'], mod.zh['overview.sessionBaselineOn']);
  });

  it('has complete bilingual locale/en.json and locale/zh.json matching package docs', () => {
    const enLocale = JSON.parse(
      fs.readFileSync(path.join(PKG_ROOT, 'locale', 'en.json'), 'utf8'),
    ) as { meta: Record<string, string> };
    const zhLocale = JSON.parse(
      fs.readFileSync(path.join(PKG_ROOT, 'locale', 'zh.json'), 'utf8'),
    ) as { meta: Record<string, string> };

    assert.ok(enLocale.meta.title && enLocale.meta.description && enLocale.meta.detail);
    assert.ok(zhLocale.meta.title && zhLocale.meta.description && zhLocale.meta.detail);
    assert.notEqual(enLocale.meta.title, zhLocale.meta.title);
    assert.notEqual(enLocale.meta.description, zhLocale.meta.description);
    assert.ok(fs.existsSync(path.join(PKG_ROOT, enLocale.meta.detail)));
    assert.ok(fs.existsSync(path.join(PKG_ROOT, zhLocale.meta.detail)));
    assert.deepEqual(
      Object.keys(enLocale.meta).sort(),
      Object.keys(zhLocale.meta).sort(),
      'locale/en.json and locale/zh.json meta keys must match',
    );
  });
});

describe('Client Slot Registrations, Reactive zh<->en Switching & SSR Smoke Tests', () => {
  it('registers all required DSH slots, switches labels reactively between zh and en, and renders all components via SSR', () => {
    const { mod } = loadCompiledClientBundle();

    let activeLocale: 'en' | 'zh' = 'en';
    let registeredLocaleNs = '';
    let registeredDicts: { zh: Record<string, string>; en: Record<string, string> } | null = null;
    const registeredSlots = new Map<
      string,
      { options: DshSlotRegisterOptions; component: React.ComponentType<any> }
    >();
    const registeredRightTabs: DshSidebarRightTabDefinition[] = [];
    const selectedPanels: string[] = [];
    const disposers: Array<() => void> = [];

    const mockCtx: DshClientContext = {
      locale: {
        getLocale: () => ({ active: activeLocale, revision: 1 }),
        getSnapshot: () => ({ active: activeLocale, revision: 1 }),
        subscribe: () => () => {},
        setLocale(id: string) {
          activeLocale = id.toLowerCase().startsWith('zh') ? 'zh' : 'en';
        },
        register(ns: string, dicts: { zh: Record<string, string>; en: Record<string, string> }) {
          registeredLocaleNs = ns;
          registeredDicts = dicts;
          return () => {};
        },
        bind(ns: string): ClientTranslateFn {
          assert.equal(ns, mod.NS);
          return (key, params) => {
            const dict = activeLocale === 'zh' ? registeredDicts!.zh : registeredDicts!.en;
            return makeTranslator(dict)(key, params);
          };
        },
      },
      layout: {
        selectPanel(id: string) {
          selectedPanels.push(id);
        },
      },
      slots: {
        inject(_key: string, cb: () => (() => void) | Iterable<() => void>) {
          const d = cb();
          if (typeof d === 'function') disposers.push(d);
          return () => {};
        },
        register(options: DshSlotRegisterOptions, component: React.ComponentType<any>) {
          registeredSlots.set(options.name, { options, component });
          return () => {
            registeredSlots.delete(options.name);
          };
        },
      },
      sidebarRightTabs: {
        register(def: DshSidebarRightTabDefinition) {
          registeredRightTabs.push(def);
          return () => {};
        },
      },
      effect(fn: () => (() => void) | void) {
        const d = fn();
        if (typeof d === 'function') disposers.push(d);
        return () => {};
      },
      inject(deps: string[], cb: (scope: unknown) => void) {
        assert.deepEqual(deps, ['sidebarRightTabs']);
        cb(mockCtx);
        return () => {};
      },
    } as unknown as DshClientContext;

    mod.apply(mockCtx);

    // Verify all 6 registration points
    assert.equal(registeredLocaleNs, 'unified-memory');
    assert.ok(registeredDicts !== null);
    assert.ok(registeredSlots.has('sidebar.panellist'));
    assert.ok(registeredSlots.has('main'));
    assert.ok(registeredSlots.has('sidebar.right.pane.tab'));
    assert.ok(registeredSlots.has('sidebar.right.pane.tab.title'));
    assert.equal(registeredRightTabs.length, 1);

    const navSlot = registeredSlots.get('sidebar.panellist')!;
    const mainSlot = registeredSlots.get('main')!;
    const rightTabSlot = registeredSlots.get('sidebar.right.pane.tab')!;
    const rightTitleSlot = registeredSlots.get('sidebar.right.pane.tab.title')!;
    const rightTabDef = registeredRightTabs[0];

    assert.equal(navSlot.options.id, 'unified-memory');
    assert.equal(mainSlot.options.key, 'unified-memory');
    assert.equal(rightTabDef.id, 'unified-memory-dsh');
    assert.equal(rightTabDef.kind, 'unified-memory');
    assert.equal(rightTabSlot.options.key, 'unified-memory-dsh');
    assert.equal(rightTitleSlot.options.key, 'unified-memory-dsh');

    // Reactive zh <-> en switching on nav label, right tab title, guide title & description
    activeLocale = 'en';
    const navLabelEn =
      typeof navSlot.options.label === 'function' ? navSlot.options.label() : navSlot.options.label;
    const rightTitleEn = rightTabDef.title('');
    const guideTitleEn = rightTabDef.guide?.[0]?.title();
    assert.equal(navLabelEn, mod.en['panel.navLabel']);
    assert.equal(rightTitleEn, mod.en['rightTab.title']);
    assert.equal(guideTitleEn, mod.en['rightTab.guideTitle']);

    activeLocale = 'zh';
    const navLabelZh =
      typeof navSlot.options.label === 'function' ? navSlot.options.label() : navSlot.options.label;
    const rightTitleZh = rightTabDef.title('');
    const guideTitleZh = rightTabDef.guide?.[0]?.title();
    assert.equal(navLabelZh, mod.zh['panel.navLabel']);
    assert.equal(rightTitleZh, mod.zh['rightTab.title']);
    assert.equal(guideTitleZh, mod.zh['rightTab.guideTitle']);
    assert.notEqual(navLabelEn, navLabelZh);
    assert.notEqual(rightTitleEn, rightTitleZh);

    // Verify openGlobalConsole callback triggers ctx.layout.selectPanel('unified-memory')
    const rightInject = rightTabSlot.options.inject?.() as { openGlobalConsole?: () => void };
    rightInject?.openGlobalConsole?.();
    assert.deepEqual(selectedPanels, ['unified-memory']);

    // Verify main slot inject exposes live active locale
    const mainInject = mainSlot.options.inject?.() as { getActiveLocale?: () => string };
    assert.equal(mainInject?.getActiveLocale?.(), 'zh');
    activeLocale = 'en';
    assert.equal(mainInject?.getActiveLocale?.(), 'en');

    // SSR smoke tests of icons & compiled slot components in both en and zh
    const mockSessionState: DshSessionListStateLike = {
      ids: ['sess-1'],
      byId: {
        'sess-1': {
          id: 'sess-1',
          cwd: '/workspace/demo',
          title: 'Demo Session',
          running: true,
          retainedBy: { mainView: 1 },
        },
      },
    };
    const useSessions = <S,>(selector: (state: DshSessionListStateLike) => S): S =>
      selector(mockSessionState);
    const tabInfo: DshSidebarRightTabInfo = {
      sidebar: { expanded: true, fullscreen: false },
      panel: { id: 'right', isFloating: false },
      tab: {
        id: 'tab-1',
        kind: 'unified-memory',
        title: 'Memory',
        visible: true,
        actions: { bindCommands: () => () => {} },
      },
    };
    const useTabInfo = () => tabInfo;

    for (const lang of ['en', 'zh'] as const) {
      const t = makeTranslator(lang === 'zh' ? mod.zh : mod.en);
      const htmlIcon = renderToStaticMarkup(
        React.createElement(MemoryPanelIcon, { size: 20, active: true }),
      );
      assert.ok(htmlIcon.includes('<svg'));

      const htmlGuide = renderToStaticMarkup(React.createElement(MemoryGuideIcon, { size: 18 }));
      assert.ok(htmlGuide.includes('<svg'));

      const htmlTitle = renderToStaticMarkup(React.createElement(SessionContextTitle, { t }));
      assert.ok(htmlTitle.includes(t('rightTab.title')));

      const htmlRightTab = renderToStaticMarkup(
        React.createElement(SessionContextTab, {
          t,
          sessionId: 'sess-1',
          useSessions,
          useTabInfo,
          openGlobalConsole: () => {},
        }),
      );
      assert.ok(htmlRightTab.includes('um-dsh-right'));

      const htmlConsole = renderToStaticMarkup(
        React.createElement(UnifiedMemoryConsole, {
          t,
          useSessions,
          getActiveLocale: () => lang,
        }),
      );
      assert.ok(htmlConsole.includes(t('panel.title')));
    }
  });

  it('renders OverviewTab, ClaudeTab, CodexTab, and RulesTab cleanly in both en and zh (including P1 regressions)', () => {
    const { mod } = loadCompiledClientBundle();

    const overview: OverviewResponse = {
      version: '0.1.1',
      pluginDataDir: '/tmp/dsh-data',
      resolvedLocale: 'en',
      hostLocalePreference: 'en',
      claude: {
        configDir: '/tmp/.claude',
        exists: true,
        hasGlobalClaudeMd: true,
        hasGlobalRulesDir: true,
        projectCount: 1,
        totalTopics: 2,
        projects: [
          {
            slug: '-workspace-alpha',
            displayPath: '/workspace/alpha',
            exactPathResolved: true,
            memoryDir: '/tmp/.claude/projects/-workspace-alpha/memory',
            hasMemoryDir: true,
            hasMemoryIndex: true,
            indexLines: 12,
            indexBytes: 320,
            topicCount: 2,
            lastModifiedMs: Date.now(),
          },
        ],
      },
      codex: {
        codexHome: '/tmp/.codex',
        exists: true,
        configFlags: { featuresMemories: true, generateMemories: true, useMemories: true },
        activeGeneration: 'v2',
        v2: {
          generation: 'v2',
          dirPath: '/tmp/.codex/memories_v2',
          exists: true,
          hasSummary: true,
          summaryBytes: 512,
          summaryLines: 20,
          summaryMtimeMs: Date.now(),
          hasHandbook: true,
          handbookBytes: 1024,
          rolloutCount: 1,
          extensionFiles: [],
          skillNames: [],
        },
        v1: {
          generation: 'v1',
          dirPath: '/tmp/.codex/memories',
          exists: false,
          hasSummary: false,
          summaryBytes: 0,
          summaryLines: 0,
          summaryMtimeMs: 0,
          hasHandbook: false,
          handbookBytes: 0,
          rolloutCount: 0,
          extensionFiles: [],
          skillNames: [],
        },
        hasGlobalAgentsMd: false,
        hasGlobalAgentsOverrideMd: false,
      },
      config: { ...DEFAULT_CONFIG },
      activeSessions: [
        {
          sessionId: 'sess-active-1',
          cwd: '/workspace/alpha',
          resolvedProjectRoot: '/workspace/alpha',
          claudeSlug: '-workspace-alpha',
          resolvedLocale: 'en',
          origin: 'root',
          isSeeded: false,
          baselineInjected: true,
          compactionCount: 1,
          hostDedupedCount: 1,
          loadedRuleCount: 1,
          loadedSubdirCount: 1,
          updatedAt: '2026-11-25T00:00:00.000Z',
        },
      ],
      recentSessions: [],
      diagnostics: [
        {
          ts: '2026-11-25T00:00:00.000Z',
          event: 'BaselineInject',
          conversationId: 'sess-active-1',
          elapsedMs: 12.3,
          workspacePaths: ['/workspace/alpha'],
          cwd: '/workspace/alpha',
          locale: 'en',
          hostDedupedCount: 1,
          injectedCount: 1,
          injectedLabels: ['Claude Memory'],
        },
        {
          ts: '2026-11-25T00:01:00.000Z',
          event: 'CompactionReload',
          conversationId: 'sess-active-1',
          elapsedMs: 8.1,
          workspacePaths: ['/workspace/alpha'],
          cwd: '/workspace/alpha',
          locale: 'zh',
          injectedCount: 1,
          injectedLabels: ['Claude Memory'],
          compactionReload: true,
        },
      ],
      workspaceHints: ['/workspace/alpha'],
    };

    for (const lang of ['en', 'zh'] as const) {
      const t = makeTranslator(lang === 'zh' ? mod.zh : mod.en);

      // OverviewTab: verify BaselineInject gets um-badge success and CompactionReload gets um-badge warn
      const overviewHtml = renderToStaticMarkup(
        React.createElement(OverviewTab, {
          t,
          overview,
          onRefresh: async () => {},
          onSelectClaudeProject: () => {},
          onSelectRulesWorkspace: () => {},
          onNotify: () => {},
        }),
      );
      assert.ok(overviewHtml.includes('um-badge success'));
      assert.ok(overviewHtml.includes('um-badge warn'));

      // ClaudeTab: verify unindexed project slug renders fallback <option>
      const claudeHtml = renderToStaticMarkup(
        React.createElement(ClaudeTab, {
          t,
          projects: overview.claude.projects,
          selectedSlug: '-workspace-brand-new',
          onSelectSlug: () => {},
          onOverviewRefresh: async () => {},
          onNotify: () => {},
        }),
      );
      assert.ok(claudeHtml.includes('-workspace-brand-new'));

      // CodexTab: read-only banner present
      const codexHtml = renderToStaticMarkup(
        React.createElement(CodexTab, {
          t,
          defaultProjectHint: '/workspace/alpha',
          onNotify: () => {},
        }),
      );
      assert.ok(codexHtml.includes(t('codex.roBannerTitle')));

      // RulesTab: renders workspace selector cleanly
      const rulesHtml = renderToStaticMarkup(
        React.createElement(RulesTab, {
          t,
          workspaceHints: overview.workspaceHints,
          selectedWorkspace: '/workspace/alpha',
          onSelectWorkspace: () => {},
          onNotify: () => {},
        }),
      );
      assert.ok(rulesHtml.includes('/workspace/alpha'));
    }

    // Verify SessionContextResponse shape matches right sidebar expectations
    const sampleCtx: SessionContextResponse = {
      session: {
        sessionId: 'sess-1',
        cwd: '/workspace/alpha',
        resolvedProjectRoot: '/workspace/alpha',
        claudeSlug: '-workspace-alpha',
        resolvedLocale: 'en',
        origin: 'root',
        isSeeded: false,
        baselineInjected: true,
        baselineInjectedAt: '2026-11-25T00:00:00.000Z',
        baselineBytes: 256,
        replaceGeneration: 0,
        compactionCount: 0,
        hostAgentInstructionsActive: true,
        hostLoadedPaths: ['/workspace/alpha/CLAUDE.md'],
        injectedLabels: ['Claude Auto Memory'],
        loadedAlwaysOnRules: [],
        indexedConditionalRules: [
          {
            id: 'r1',
            displayPath: '.claude/rules/api.md',
            filePath: '/workspace/alpha/.claude/rules/api.md',
            paths: ['src/api/**'],
            scope: 'project',
            loaded: true,
            triggeredBy: '/workspace/alpha/src/api/foo.ts',
          },
          {
            id: 'r2',
            displayPath: '.claude/rules/ui.md',
            filePath: '/workspace/alpha/.claude/rules/ui.md',
            paths: ['src/ui/**'],
            scope: 'project',
            loaded: false,
          },
        ],
        loadedSubdirClaudeMds: [],
        pendingExternalApprovalCount: 0,
        claudeMemoryIndex: null,
        codexSummaryInjected: false,
        updatedAt: '2026-11-25T00:00:00.000Z',
      },
      activeSessions: overview.activeSessions,
    };
    assert.equal(sampleCtx.session?.indexedConditionalRules.length, 2);
  });
});

describe('Package Manifest, Cordis Patch & DSH AppBoot Metadata Checks', () => {
  it('validates zero-compile package.json contract and cordis.patch.yml defaults', () => {
    const pkg = JSON.parse(fs.readFileSync(PKG_JSON_PATH, 'utf8')) as {
      name: string;
      version: string;
      type: string;
      main: string;
      icon: string;
      exports: Record<string, string>;
      files: string[];
      engines: Record<string, string>;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      dsh: {
        manifestVersion: number;
        bundle: { patch: string; platforms?: string[]; listedByDefault?: boolean };
        client: { platform: string; inject: string[]; immediately: boolean };
      };
    };

    assert.equal(pkg.name, 'unified-memory-dsh');
    assert.equal(pkg.type, 'module');
    assert.equal(pkg.main, './lib/index.js');
    assert.deepEqual(pkg.dependencies, {});
    assert.equal(pkg.scripts.prepare, undefined, 'Zero-compile plugin must not define prepare');
    assert.equal(pkg.scripts.postinstall, undefined, 'Zero-compile plugin must not define postinstall');
    assert.equal(pkg.scripts.install, undefined, 'Zero-compile plugin must not define install');

    assert.equal(pkg.exports['.'], './lib/index.js');
    assert.equal(pkg.exports['./client'], './lib/client.js');
    assert.equal(pkg.exports['./package.json'], './package.json');
    assert.equal(pkg.exports['./cordis.patch.yml'], './cordis.patch.yml');
    assert.equal(pkg.exports['./locale/*.json'], './locale/*.json');

    assert.equal(pkg.dsh.manifestVersion, 1);
    assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
    assert.equal(pkg.dsh.bundle.platforms, undefined, 'Cross-OS plugin should omit bundle.platforms');
    assert.equal(pkg.dsh.client.platform, 'web');
    assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-locale'));
    assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-renderer'));
    assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-session'));
    assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-sidebar'));
    assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-sidebar-right'));
    assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-layout'));

    // Icon asset exists and is <= 256 KiB
    const iconPath = path.join(PKG_ROOT, pkg.icon);
    assert.ok(fs.existsSync(iconPath), 'assets/icon.svg must exist');
    assert.ok(fs.statSync(iconPath).size <= 256 * 1024);

    // Compiled bundles exist and no bloated lib/index.js.map shipped
    assert.ok(fs.existsSync(HOST_BUNDLE_PATH));
    assert.ok(fs.existsSync(CLIENT_BUNDLE_PATH));
    assert.equal(
      fs.existsSync(path.join(PKG_ROOT, 'lib', 'index.js.map')),
      false,
      'lib/index.js.map should not exist in lean zero-compile distribution',
    );
    assert.equal(
      pkg.files.includes('lib/index.js.map'),
      false,
      'package.json files should not include lib/index.js.map',
    );

    // cordis.patch.yml uses bare package name and matches DEFAULT_CONFIG defaults
    const patchYml = fs.readFileSync(PATCH_YML_PATH, 'utf8');
    assert.ok(patchYml.includes("name: 'unified-memory-dsh'") || patchYml.includes('name: unified-memory-dsh'));
    assert.ok(patchYml.includes(`locale: ${DEFAULT_CONFIG.locale}`));
    assert.ok(
      patchYml.includes(`injectCodexSummaryOnStart: ${DEFAULT_CONFIG.injectCodexSummaryOnStart}`),
    );
    assert.ok(patchYml.includes(`codexSummaryMaxBytes: ${DEFAULT_CONFIG.codexSummaryMaxBytes}`));
    assert.ok(
      patchYml.includes(`injectCodexGlobalAgentsMd: ${DEFAULT_CONFIG.injectCodexGlobalAgentsMd}`),
    );
    assert.ok(
      patchYml.includes(`deduplicateNativeAgentsMd: ${DEFAULT_CONFIG.deduplicateNativeAgentsMd}`),
    );
    assert.ok(patchYml.includes(`maxStartupInjectBytes: ${DEFAULT_CONFIG.maxStartupInjectBytes}`));
    assert.ok(
      patchYml.includes(
        `trustClaudeCodeExternalApprovals: ${DEFAULT_CONFIG.trustClaudeCodeExternalApprovals}`,
      ),
    );
  });

  it('passes real DSH AppBoot compatibility, platform admission, and bilingual plugin-detail resolution', async (t) => {
    const appBootDir = resolveDshPackagePath('@deepseek-ai/dsh-app-boot');
    const pluginDetailDir = resolveDshPackagePath('@deepseek-ai/dsh-plugin-detail');
    if (!appBootDir || !pluginDetailDir) {
      t.skip('DSH runtime packages not available in node_modules or DSH_TEST_PKG_DIR');
      return;
    }

    const appBoot = await import(pathToFileURL(path.join(appBootDir, 'lib', 'index.js')).href);
    const pluginDetail = await import(
      pathToFileURL(path.join(pluginDetailDir, 'lib', 'index.js')).href
    );
    const pkg = JSON.parse(fs.readFileSync(PKG_JSON_PATH, 'utf8'));
    const runtimeVersion = appBoot.getDshRuntimeVersion();

    // 1. Compatibility: undefined means every requirement is satisfied
    const unmet = appBoot.evaluatePluginCompatibility(pkg, {}, runtimeVersion);
    assert.equal(
      unmet,
      undefined,
      `Plugin should be compatible with DSH ${runtimeVersion}, got: ${JSON.stringify(unmet)}`,
    );

    // 2. Platform admission across darwin/linux/win32
    for (const platform of ['darwin', 'linux', 'win32']) {
      assert.doesNotThrow(() => appBoot.assertBundlePlatform(pkg.dsh?.bundle?.platforms, platform));
    }

    // 3. Plugin detail document resolution for both en and zh-CN -> zh
    const files = pluginDetail.localFiles(PKG_ROOT);
    const docEn = await pluginDetail.readPackageDocument(
      files,
      '',
      pluginDetail.languageChain('en'),
      1024 * 1024,
      new AbortController().signal,
    );
    const docZh = await pluginDetail.readPackageDocument(
      files,
      '',
      pluginDetail.languageChain('zh-CN'),
      1024 * 1024,
      new AbortController().signal,
    );

    assert.equal(docEn?.origin, 'locale');
    assert.equal(docEn?.path, 'docs/DETAIL.md');
    assert.ok((docEn?.markdown?.length ?? 0) > 200);

    assert.equal(docZh?.origin, 'locale');
    assert.equal(docZh?.path, 'docs/DETAIL.zh.md');
    assert.ok((docZh?.markdown?.length ?? 0) > 200);

    // 4. Verify real readPluginMeta when Node ModuleLoader internal resolver is active
    const loaderPkgDir = resolveDshPackagePath('@deepseek-ai/cordis-plugin-loader');
    if (loaderPkgDir && typeof appBoot.readPluginMeta === 'function') {
      const loaderPkg = await import(pathToFileURL(path.join(loaderPkgDir, 'lib', 'index.js')).href);
      if (loaderPkg.ModuleLoader?.fromInternal?.()) {
        // Only run when invoked under DSH's ESM loader hook
        const meta = appBoot.readPluginMeta('unified-memory-dsh', pathToFileURL(PKG_JSON_PATH).href);
        if (meta && !meta.error) {
          assert.ok(meta.title?.en && meta.title?.zh);
          assert.ok(meta.description?.en && meta.description?.zh);
        }
      }
    }
  });
});
