import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CORE_MESSAGES,
  getMessages,
  normalizeLocale,
  normalizeLocalePreference,
  resolveLocale,
  type ResolvedLocale,
} from '../src/core/index.js';

describe('i18n locale normalization & precedence chain', () => {
  it('normalizes BCP-47 and POSIX locale tags to canonical DSH zh | en', () => {
    for (const zhTag of ['zh', 'zh-CN', 'zh-cn', 'zh_CN', 'zh_CN.UTF-8', 'zh-Hans', 'zh-TW', 'ZH-HK']) {
      assert.equal(normalizeLocale(zhTag), 'zh', `expected "${zhTag}" -> "zh"`);
      assert.equal(normalizeLocalePreference(zhTag), 'zh', `expected pref "${zhTag}" -> "zh"`);
    }

    for (const enTag of ['en', 'en-US', 'en_GB.UTF-8', 'EN-AU']) {
      assert.equal(normalizeLocale(enTag), 'en', `expected "${enTag}" -> "en"`);
      assert.equal(normalizeLocalePreference(enTag), 'en', `expected pref "${enTag}" -> "en"`);
    }

    for (const neutral of ['', '  ', 'auto', 'AUTO', 'C', 'POSIX', 'C.UTF-8', 'fr-FR', 'ja-JP', null, undefined, 123]) {
      assert.equal(normalizeLocale(neutral), null, `expected "${String(neutral)}" -> null`);
      assert.equal(normalizeLocalePreference(neutral), 'auto', `expected pref "${String(neutral)}" -> "auto"`);
    }
  });

  it('enforces exact resolveLocale precedence: config > UNIFIED_MEMORY_LOCALE > hostLocale > LC_ALL > LC_MESSAGES > LANG > systemLocale > en', () => {
    // 1. Explicit config overrides everything
    assert.equal(
      resolveLocale({
        configLocale: 'en',
        env: { UNIFIED_MEMORY_LOCALE: 'zh', LC_ALL: 'zh_CN.UTF-8', LANG: 'zh_CN.UTF-8' },
        hostLocale: 'zh',
        systemLocale: 'zh-CN',
      }),
      'en',
    );
    assert.equal(
      resolveLocale({
        configLocale: 'zh-CN',
        env: { UNIFIED_MEMORY_LOCALE: 'en', LANG: 'en_US.UTF-8' },
        hostLocale: 'en',
        systemLocale: 'en-US',
      }),
      'zh',
    );

    // 2. UNIFIED_MEMORY_LOCALE overrides hostLocale & POSIX when config is 'auto'
    assert.equal(
      resolveLocale({
        configLocale: 'auto',
        env: { UNIFIED_MEMORY_LOCALE: 'zh-CN', LC_ALL: 'en_US.UTF-8' },
        hostLocale: 'en',
        systemLocale: 'en-US',
      }),
      'zh',
    );

    // 3. Host locale preference (DSH settings locale.preference) overrides POSIX/system
    assert.equal(
      resolveLocale({
        configLocale: 'auto',
        env: { LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8' },
        hostLocale: 'zh',
        systemLocale: 'en-US',
      }),
      'zh',
    );

    // 4. POSIX LC_ALL > LC_MESSAGES > LANG
    assert.equal(
      resolveLocale({
        configLocale: 'auto',
        env: { LC_ALL: 'zh_CN.UTF-8', LC_MESSAGES: 'en_US.UTF-8', LANG: 'en_US.UTF-8' },
        hostLocale: 'auto',
        systemLocale: 'en-US',
      }),
      'zh',
    );
    assert.equal(
      resolveLocale({
        configLocale: 'auto',
        env: { LC_ALL: 'C', LC_MESSAGES: 'zh_CN.UTF-8', LANG: 'en_US.UTF-8' },
        hostLocale: 'auto',
        systemLocale: 'en-US',
      }),
      'zh',
    );
    assert.equal(
      resolveLocale({
        configLocale: 'auto',
        env: { LANG: 'zh_CN.UTF-8' },
        hostLocale: null,
        systemLocale: 'en-US',
      }),
      'zh',
    );

    // 5. System locale fallback
    assert.equal(
      resolveLocale({
        configLocale: 'auto',
        env: {},
        hostLocale: 'auto',
        systemLocale: 'zh-Hans-CN',
      }),
      'zh',
    );

    // 6. Default fallback to 'en' when unrecognized
    assert.equal(
      resolveLocale({
        configLocale: 'auto',
        env: { LANG: 'de_DE.UTF-8' },
        hostLocale: 'auto',
        systemLocale: 'ja-JP',
      }),
      'en',
    );
  });
});

describe('i18n message catalog parity & prompt-cache determinism', () => {
  it('maintains 100% key and value-kind parity between en and zh catalogs with non-empty outputs', () => {
    const enKeys = Object.keys(CORE_MESSAGES.en).sort();
    const zhKeys = Object.keys(CORE_MESSAGES.zh).sort();
    assert.deepEqual(enKeys, zhKeys);
    assert.ok(enKeys.length >= 30);

    for (const key of enKeys) {
      const enVal = CORE_MESSAGES.en[key as keyof typeof CORE_MESSAGES.en];
      const zhVal = CORE_MESSAGES.zh[key as keyof typeof CORE_MESSAGES.zh];
      assert.equal(typeof enVal, typeof zhVal, `type mismatch for key "${key}"`);
      if (typeof enVal === 'string' && typeof zhVal === 'string') {
        assert.ok(enVal.trim().length > 0, `empty en string for "${key}"`);
        assert.ok(zhVal.trim().length > 0, `empty zh string for "${key}"`);
      }
    }
  });

  it('produces deterministic, timestamp-free prompt headers preserving canonical ASCII protocol tokens', () => {
    const isoTsRe = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

    for (const locale of ['en', 'zh'] as ResolvedLocale[]) {
      const m = getMessages(locale);
      const samples = [
        m.baselineHeaderSessionStart,
        m.baselineHeaderCompactionReload,
        m.lazyHeaderScopedRules,
        m.sectionGlobalClaudeInstructions,
        m.sectionProjectClaudeInstructions('demo', '/repo/demo'),
        m.sectionClaudeMemoryIndex('demo'),
        m.sectionClaudeMemoryEmpty('demo'),
        m.sectionCodexSummary('v2'),
        m.sectionCodexGlobalAgents('AGENTS.md'),
        m.claudeMemoryCanonicalDirLine('/home/.claude/projects/x/memory', '-repo-demo', true),
        m.claudeMemoryToolsHintLine,
        m.claudeMemoryEmptyLine('/home/.claude/projects/x/memory'),
        m.claudeMemoryTruncatedNote(200, 240, '24.5', '31.0'),
        m.codexReadOnlyNoticeLine,
        m.codexSummaryTruncatedNote('8.0'),
        m.startupContextTruncatedNote('64'),
        m.pendingExternalRuleNotice(2),
        m.hostDedupedImportOnlySubtitle('CLAUDE.md'),
        m.scopedRuleMatchedSubtitle('.claude/rules/api.md', 'src/api/users.ts'),
        m.subdirClaudeMdTriggeredSubtitle('packages/api/CLAUDE.md', 'packages/api/index.ts'),
      ];

      for (const s of samples) {
        assert.ok(s.trim().length > 0);
        assert.equal(isoTsRe.test(s), false, `injected message must not contain timestamp: ${s}`);
      }

      // Canonical tool names & paths remain untranslated ASCII
      assert.ok(m.claudeMemoryToolsHintLine.includes('claude_memory_read'));
      assert.ok(m.claudeMemoryToolsHintLine.includes('claude_memory_save'));
      assert.ok(m.claudeMemoryToolsHintLine.includes('claude_memory_delete'));
      assert.ok(m.codexReadOnlyNoticeLine.includes('~/.codex'));
      assert.ok(m.codexReadOnlyNoticeLine.includes('codex_memory_search'));
    }

    // Verify zh & en produce distinct localized copy and byte-identical repeated calls
    const zh1 = getMessages('zh').baselineHeaderSessionStart;
    const zh2 = getMessages('zh').baselineHeaderSessionStart;
    const en1 = getMessages('en').baselineHeaderSessionStart;
    assert.equal(zh1, zh2);
    assert.notEqual(zh1, en1);
    assert.ok(/[\u4e00-\u9fff]/.test(zh1));
  });
});
