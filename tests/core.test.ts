import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, it } from 'node:test';
import {
  appendDiagnosticEvent,
  clearDiagnosticEvents,
  createEmptySessionState,
  deleteTopicMemory,
  detectCompaction,
  encodeClaudeProjectSlug,
  expandAtImports,
  extractTopicMetadata,
  findSubdirectoryClaudeMds,
  findSubdirectoryClaudeMdsWithDiagnostics,
  getCodexMemoryStatus,
  listRecentSessions,
  listTopicMemories,
  loadClaudeRulesForWorkspaces,
  loadConditionalRuleContentWithDiagnostics,
  loadPluginConfig,
  loadSessionState,
  matchesGlobPatterns,
  parseFrontmatter,
  readClaudeCodeExternalApproval,
  readCodexMemoryFile,
  readCodexSummary,
  readDiagnosticEvents,
  readMemoryIndex,
  readTopicMemory,
  resolveClaudeProject,
  resolvePluginDataDir,
  sanitizeTopicFilename,
  savePluginConfig,
  saveSessionState,
  saveTopicMemory,
  searchCodexMemories,
  stripCodexVersionHeader,
  stripHtmlComments,
  tokenizeQuery,
  truncateMemoryIndex,
  updateWorkspaceExternalTrust,
  withFileLock,
  writeMemoryIndexRaw,
} from '../src/core/index.js';

function mkTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('Claude Code path encoding & Git worktree resolution', () => {
  it('encodes slashes, dots, underscores, and spaces 1-to-1 as hyphens', () => {
    assert.equal(
      encodeClaudeProjectSlug('/Users/alice/Workspace/Acme.v2_App_Service'),
      '-Users-alice-Workspace-Acme-v2-App-Service',
    );
    assert.equal(
      encodeClaudeProjectSlug('/Users/alice/Library/Application Support/Demo App/Probe'),
      '-Users-alice-Library-Application-Support-Demo-App-Probe',
    );
  });

  it('truncates paths exceeding 200 chars with deterministic hash suffix', () => {
    const longPath = '/Users/test/' + 'segment_'.repeat(35) + 'proj';
    const slug1 = encodeClaudeProjectSlug(longPath);
    const slug2 = encodeClaudeProjectSlug(longPath);
    assert.equal(slug1, slug2);
    assert.ok(slug1.length > 200 && slug1.length < 220);
    assert.notEqual(slug1, encodeClaudeProjectSlug(longPath + '2'));
  });

  it('resolves a linked git worktree back to its main repository root and honors disable env', () => {
    const root = mkTempDir('um-dsh-wt-');
    try {
      const mainRepo = path.join(root, 'main-repo');
      const linkedWt = path.join(root, 'linked-wt');
      const fakeClaude = path.join(root, '.claude');
      fs.mkdirSync(mainRepo, { recursive: true });
      fs.mkdirSync(fakeClaude, { recursive: true });

      execFileSync('git', ['init', '-b', 'main'], { cwd: mainRepo, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: mainRepo });
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: mainRepo });
      fs.writeFileSync(path.join(mainRepo, 'README.md'), '# main\n');
      execFileSync('git', ['add', '.'], { cwd: mainRepo });
      execFileSync('git', ['commit', '-m', 'init'], { cwd: mainRepo, stdio: 'ignore' });
      execFileSync('git', ['worktree', 'add', '-b', 'feat-1', linkedWt], {
        cwd: mainRepo,
        stdio: 'ignore',
      });

      const mainRes = resolveClaudeProject(mainRepo, { claudeConfigDir: fakeClaude, env: {} });
      const wtRes = resolveClaudeProject(linkedWt, { claudeConfigDir: fakeClaude, env: {} });

      assert.equal(wtRes.isGitWorktree, true);
      assert.equal(fs.realpathSync(wtRes.resolvedRoot), fs.realpathSync(mainRes.resolvedRoot));
      assert.equal(wtRes.slug, mainRes.slug);
      assert.equal(wtRes.memoryDir, mainRes.memoryDir);

      const disabledRes = resolveClaudeProject(mainRepo, {
        claudeConfigDir: fakeClaude,
        env: { CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' },
      });
      assert.equal(disabledRes.autoMemoryEnabled, false);
      assert.equal(disabledRes.disabledByEnv, true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('Claude Code v2.1.x & legacy frontmatter, atomic CRUD, lockfile & CJK safety', () => {
  it('parses both legacy flat and v2.1.x nested metadata schemas', () => {
    const flat = parseFrontmatter(
      `---\nname: legacy-note\ndescription: Old flat format\ntype: feedback\noriginSessionId: sess-1\n---\n\nBody text\n`,
    );
    const flatMeta = extractTopicMetadata(flat);
    assert.equal(flatMeta.schema, 'flat');
    assert.equal(flatMeta.type, 'feedback');
    assert.equal(flatMeta.originSessionId, 'sess-1');

    const nested = parseFrontmatter(
      `---\nname: v2-note\ndescription: New nested metadata format\nmetadata:\n  node_type: memory\n  type: project\n  originSessionId: sess-2\n  modified: 2026-09-24T01:16:55.436Z\n---\n\nNested body\n`,
    );
    const nestedMeta = extractTopicMetadata(nested);
    assert.equal(nestedMeta.schema, 'nested_metadata');
    assert.equal(nestedMeta.nodeType, 'memory');
    assert.equal(nestedMeta.type, 'project');
    assert.equal(nestedMeta.modified, '2026-09-24T01:16:55.436Z');
  });

  it('writes v2.1.x nested metadata, uses .unified-memory.lock, syncs MEMORY.md, and deletes cleanly', () => {
    const dir = mkTempDir('um-dsh-mem-');
    try {
      const memDir = path.join(dir, 'memory');
      fs.mkdirSync(memDir, { recursive: true });
      fs.writeFileSync(
        path.join(memDir, 'MEMORY.md'),
        '# Memory Index\n\n- [Existing](existing.md) — kept intact\n\n[ref-doc]: https://example.com\n',
      );

      // Verify lockfile uses canonical `.unified-memory.lock` during critical section and removes it on exit
      let lockPresentDuringWork = false;
      withFileLock(memDir, () => {
        lockPresentDuringWork = fs.existsSync(path.join(memDir, '.unified-memory.lock'));
      });
      assert.equal(lockPresentDuringWork, true);
      assert.equal(fs.existsSync(path.join(memDir, '.unified-memory.lock')), false);

      const saved = saveTopicMemory(memDir, {
        name: 'No Mock DB Tests',
        description: 'Always run integration tests against real SQLite',
        type: 'feedback',
        body: 'User prefers real DB instances in integration tests.',
        originSessionId: 'conv-123',
      });

      assert.equal(saved.topic.schema, 'nested_metadata');
      assert.equal(saved.topic.nodeType, 'memory');
      assert.equal(saved.topic.type, 'feedback');
      assert.equal(saved.topic.originSessionId, 'conv-123');
      assert.ok(saved.topic.modified && saved.topic.modified.endsWith('Z'));
      assert.equal(saved.topic.filename, 'no-mock-db-tests.md');

      const idx = readMemoryIndex(memDir);
      assert.ok(idx.content.includes('(existing.md)'));
      assert.ok(idx.content.includes('(no-mock-db-tests.md)'));
      assert.ok(idx.content.includes('[ref-doc]: https://example.com'));

      // Update preserves originSessionId and updates index line in place without duplicating
      const updated = saveTopicMemory(memDir, {
        filename: 'no-mock-db-tests.md',
        name: 'No Mock DB Tests',
        description: 'Updated description',
        type: 'feedback',
        body: 'Updated body',
      });
      assert.equal(updated.topic.originSessionId, 'conv-123');
      const idx2 = readMemoryIndex(memDir);
      const matches = idx2.content.match(/no-mock-db-tests\.md/g) ?? [];
      assert.equal(matches.length, 1);
      assert.ok(idx2.content.includes('Updated description'));

      // Delete removes topic and index entry cleanly
      const del = deleteTopicMemory(memDir, 'no-mock-db-tests.md');
      assert.equal(del.deleted, true);
      assert.equal(listTopicMemories(memDir).length, 0);
      assert.ok(!del.index.content.includes('no-mock-db-tests.md'));
      assert.ok(del.index.content.includes('(existing.md)'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('handles pure-CJK topic names deterministically without throwing and rejects reserved/traversal names', () => {
    const f1 = sanitizeTopicFilename('不要模拟数据库');
    const f2 = sanitizeTopicFilename('不要模拟数据库');
    const f3 = sanitizeTopicFilename('优先使用真实集成测试');
    assert.equal(f1, f2);
    assert.match(f1, /^topic-[a-z0-9]+\.md$/);
    assert.notEqual(f1, f3);

    // Path traversal, reserved MEMORY, and punctuation-only inputs still throw
    assert.throws(() => sanitizeTopicFilename('../escape.md'));
    assert.throws(() => sanitizeTopicFilename('MEMORY.md'));
    assert.throws(() => sanitizeTopicFilename('---'));
    assert.throws(() => sanitizeTopicFilename('   '));

    const dir = mkTempDir('um-dsh-cjk-mem-');
    try {
      const memDir = path.join(dir, 'memory');
      const saved = saveTopicMemory(memDir, {
        name: '不要模拟数据库',
        description: '集成测试必须连接真实 SQLite 数据库',
        type: 'feedback',
        body: '历史踩坑：Mock 数据库曾掩盖了迁移脚本错误。',
        locale: 'zh',
      });
      assert.equal(saved.topic.filename, f1);
      assert.equal(saved.topic.name, '不要模拟数据库');
      assert.equal(saved.topic.schema, 'nested_metadata');
      const idx = readMemoryIndex(memDir);
      assert.ok(idx.content.includes(`[不要模拟数据库](${f1})`));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('truncates MEMORY.md strictly at 200 lines or 25 KB and localizes budget warnings', () => {
    const lines250 = Array.from({ length: 250 }, (_, i) => `- item ${i + 1}`).join('\n');
    const byLine = truncateMemoryIndex(lines250);
    assert.equal(byLine.truncated, true);
    assert.equal(byLine.includedLines, 200);
    assert.equal(byLine.totalLines, 250);

    const bigLines = Array.from({ length: 50 }, (_, i) => `- ${i}: ${'x'.repeat(1000)}`).join('\n');
    const byByte = truncateMemoryIndex(bigLines);
    assert.equal(byByte.truncated, true);
    assert.ok(byByte.includedBytes <= 25 * 1024);
    assert.ok(byByte.includedLines < 50);

    const dir = mkTempDir('um-dsh-warn-');
    try {
      const memDir = path.join(dir, 'memory');
      fs.mkdirSync(memDir, { recursive: true });
      fs.writeFileSync(path.join(memDir, 'MEMORY.md'), lines250 + '\n');

      const zhRes = saveTopicMemory(memDir, {
        name: 'budget-check',
        description: 'Check Chinese warning',
        type: 'project',
        body: 'Note',
        locale: 'zh',
      });
      assert.equal(zhRes.warnings.length, 1);
      assert.ok(zhRes.warnings[0].includes('已超出'));

      const enRes = saveTopicMemory(memDir, {
        filename: 'budget-check.md',
        name: 'budget-check',
        description: 'Check English warning',
        type: 'project',
        body: 'Note',
        locale: 'en',
      });
      assert.equal(enRes.warnings.length, 1);
      assert.ok(enRes.warnings[0].includes('exceeds'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('CLAUDE.md & .claude/rules loading, host dedup, @imports, comments, globs, and trust', () => {
  it('strips HTML comments outside code fences & inline code', () => {
    const md = [
      'Visible line <!-- hidden inline --> end',
      '<!--',
      'hidden multiline',
      '-->',
      '```html',
      '<!-- keep inside code fence -->',
      '```',
      'Keep `<!-- inside backticks -->` too',
    ].join('\n');
    const cleaned = stripHtmlComments(md);
    assert.ok(!cleaned.includes('hidden inline'));
    assert.ok(!cleaned.includes('hidden multiline'));
    assert.ok(cleaned.includes('<!-- keep inside code fence -->'));
    assert.ok(cleaned.includes('`<!-- inside backticks -->`'));
  });

  it('matches globs with ** and brace expansion {ts,tsx}', () => {
    assert.equal(matchesGlobPatterns('src/api/v1/users.ts', ['src/api/**/*.{ts,tsx}']), true);
    assert.equal(matchesGlobPatterns('src/api/users.tsx', ['src/api/**/*.{ts,tsx}']), true);
    assert.equal(matchesGlobPatterns('src/api/users.py', ['src/api/**/*.{ts,tsx}']), false);
  });

  it('loads workspace CLAUDE.md, dedupes native AGENTS.md/AGENTS.local.md, respects claudeMdExcludes, and supports alreadyLoadedPaths exact dedup', () => {
    const root = mkTempDir('um-dsh-rules-');
    try {
      const fakeClaude = path.join(root, '.claude-global');
      const ws = path.join(root, 'repo');
      fs.mkdirSync(path.join(fakeClaude, 'rules'), { recursive: true });
      fs.mkdirSync(path.join(ws, '.claude', 'rules', 'backend'), { recursive: true });
      fs.mkdirSync(path.join(ws, 'packages', 'api'), { recursive: true });

      fs.writeFileSync(path.join(fakeClaude, 'CLAUDE.md'), 'GLOBAL_CLAUDE_RULE\n');
      fs.writeFileSync(path.join(ws, 'AGENTS.md'), 'NATIVE_AGENTS_MD\n');
      fs.writeFileSync(path.join(ws, 'AGENTS.local.md'), 'NATIVE_AGENTS_LOCAL_MD\n');
      fs.writeFileSync(path.join(ws, 'extra.md'), 'IMPORTED_EXTRA_MD\n');
      fs.writeFileSync(
        path.join(ws, 'CLAUDE.md'),
        '# Root\n@AGENTS.md\n@AGENTS.local.md\n@extra.md\n<!-- comment -->\nROOT_RULE\n',
      );
      fs.writeFileSync(path.join(ws, 'CLAUDE.local.md'), 'LOCAL_OVERRIDE_RULE\n');
      fs.writeFileSync(
        path.join(ws, '.claude', 'rules', 'always.md'),
        'ALWAYS_ON_PROJECT_RULE\n',
      );
      fs.writeFileSync(
        path.join(ws, '.claude', 'rules', 'ignored.md'),
        'EXCLUDED_RULE_CONTENT\n',
      );
      fs.writeFileSync(
        path.join(ws, '.claude', 'settings.json'),
        JSON.stringify({ claudeMdExcludes: ['.claude/rules/ignored.md'] }),
      );
      fs.writeFileSync(
        path.join(ws, '.claude', 'rules', 'backend', 'api.md'),
        '---\npaths:\n  - "packages/api/**/*.{ts,tsx}"\n---\nSCOPED_API_RULE\n',
      );
      fs.writeFileSync(
        path.join(ws, 'packages', 'api', 'sub-extra.md'),
        'SUBDIR_IMPORTED_EXTRA\n',
      );
      fs.writeFileSync(
        path.join(ws, 'packages', 'api', 'CLAUDE.md'),
        '@sub-extra.md\nSUBDIR_API_CLAUDE_MD\n',
      );

      // 1. Without alreadyLoadedPaths (e.g. DSH minimal preset where dsh-agent-instructions is absent)
      const fullLoaded = loadClaudeRulesForWorkspaces([ws], {
        claudeConfigDir: fakeClaude,
        deduplicateNativeAgentsMd: true,
      });

      assert.equal(fullLoaded.globalAlwaysOn.length, 1);
      const fullBundle = fullLoaded.workspaces[0];
      const combinedAlways = fullBundle.alwaysOn.map((r) => r.content).join('\n');
      assert.ok(combinedAlways.includes('ROOT_RULE'));
      assert.ok(combinedAlways.includes('IMPORTED_EXTRA_MD'));
      assert.ok(combinedAlways.includes('ALWAYS_ON_PROJECT_RULE'));
      assert.ok(combinedAlways.includes('LOCAL_OVERRIDE_RULE'));
      assert.ok(!combinedAlways.includes('NATIVE_AGENTS_MD'));
      assert.ok(!combinedAlways.includes('NATIVE_AGENTS_LOCAL_MD'));
      assert.ok(!combinedAlways.includes('EXCLUDED_RULE_CONTENT'));
      assert.ok(!combinedAlways.includes('SCOPED_API_RULE'));
      assert.equal(fullBundle.excludedPaths.length, 1);
      assert.equal(fullBundle.conditional.length, 1);
      assert.deepEqual(fullBundle.conditional[0].paths, ['packages/api/**/*.{ts,tsx}']);
      assert.equal(fullBundle.alwaysOn.every((r) => r.dedupedByHost === false), true);

      // 2. With alreadyLoadedPaths simulating dsh-agent-instructions loading bare CLAUDE.md & CLAUDE.local.md
      const hostLoaded = new Set([
        path.join(ws, 'CLAUDE.md'),
        path.join(ws, 'CLAUDE.local.md'),
      ]);
      const dedupLoaded = loadClaudeRulesForWorkspaces([ws], {
        claudeConfigDir: fakeClaude,
        deduplicateNativeAgentsMd: true,
        alreadyLoadedPaths: hostLoaded,
      });
      const dedupBundle = dedupLoaded.workspaces[0];
      const rootClaudeEntry = dedupBundle.alwaysOn.find((r) => r.displayPath === 'CLAUDE.md')!;
      const localClaudeEntry = dedupBundle.alwaysOn.find(
        (r) => r.displayPath === 'CLAUDE.local.md',
      )!;
      const alwaysRuleEntry = dedupBundle.alwaysOn.find(
        (r) => r.displayPath === '.claude/rules/always.md',
      )!;

      assert.equal(rootClaudeEntry.dedupedByHost, true);
      assert.ok(rootClaudeEntry.content.includes('ROOT_RULE')); // full preview preserved for UI
      assert.ok(rootClaudeEntry.importedOnlyContent.includes('IMPORTED_EXTRA_MD'));
      assert.ok(!rootClaudeEntry.importedOnlyContent.includes('ROOT_RULE')); // raw body omitted!

      assert.equal(localClaudeEntry.dedupedByHost, true);
      assert.equal(localClaudeEntry.importedOnlyContent, '');

      assert.equal(alwaysRuleEntry.dedupedByHost, false);
      assert.ok(alwaysRuleEntry.content.includes('ALWAYS_ON_PROJECT_RULE'));

      // 3. Subdirectory CLAUDE.md also honors alreadyLoadedPaths while preserving @import expansions
      const subHostLoaded = new Set([path.join(ws, 'packages', 'api', 'CLAUDE.md')]);
      const subdirs = findSubdirectoryClaudeMds(
        path.join(ws, 'packages', 'api', 'handler.ts'),
        ws,
        { claudeConfigDir: fakeClaude, alreadyLoadedPaths: subHostLoaded },
      );
      assert.equal(subdirs.length, 1);
      assert.equal(subdirs[0].dedupedByHost, true);
      assert.ok(subdirs[0].importedOnlyContent.includes('SUBDIR_IMPORTED_EXTRA'));
      assert.ok(!subdirs[0].importedOnlyContent.includes('SUBDIR_API_CLAUDE_MD'));

      // 4. Cycle detection + customizable hostName on @import
      fs.writeFileSync(path.join(ws, 'a.md'), '@b.md\n@AGENTS.md\nA_BODY\n');
      fs.writeFileSync(path.join(ws, 'b.md'), '@a.md\nB_BODY\n');
      const exp = expandAtImports('@b.md\n@AGENTS.md\nA_BODY\n', path.join(ws, 'a.md'), {
        workspaceRoots: [ws],
        hostName: 'DeepSeek Harness',
      });
      assert.ok(exp.content.includes('B_BODY'));
      assert.ok(exp.content.includes('already natively loaded by DeepSeek Harness'));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('enforces external @import and rule symlink trust for repo rules while trusting user-level rules', () => {
    const root = mkTempDir('um-dsh-ext-trust-');
    try {
      const fakeClaude = path.join(root, '.claude-global');
      const extDir = path.join(root, 'external-notes');
      const otherExtDir = path.join(root, 'other-secret');
      const wsA = path.join(root, 'repo-a');
      const wsB = path.join(root, 'repo-b');
      const pluginData = path.join(root, 'plugin-data');

      fs.mkdirSync(path.join(fakeClaude, 'rules'), { recursive: true });
      fs.mkdirSync(extDir, { recursive: true });
      fs.mkdirSync(otherExtDir, { recursive: true });
      fs.mkdirSync(path.join(wsA, '.claude', 'rules'), { recursive: true });
      fs.mkdirSync(path.join(wsA, 'docs'), { recursive: true });
      fs.mkdirSync(path.join(wsA, 'subpkg'), { recursive: true });
      fs.mkdirSync(wsB, { recursive: true });

      const styleFile = path.join(extDir, 'writing-style.md');
      const sharedRuleFile = path.join(extDir, 'shared-rule.md');
      const userExtRuleFile = path.join(otherExtDir, 'user-only-rule.md');
      const secretFile = path.join(otherExtDir, 'secret.md');
      fs.writeFileSync(styleFile, 'EXT_STYLE_CONTENT\n');
      fs.writeFileSync(sharedRuleFile, 'EXT_SHARED_RULE_CONTENT\n');
      fs.writeFileSync(userExtRuleFile, 'USER_EXT_SYMLINK_CONTENT\n');
      fs.writeFileSync(secretFile, 'EXT_SECRET_CONTENT\n');
      fs.symlinkSync(secretFile, path.join(extDir, 'escape.md'));

      // User-level rules (trusted by default)
      fs.writeFileSync(path.join(fakeClaude, 'CLAUDE.md'), `@${styleFile}\nUSER_OWN_RULE\n`);
      fs.symlinkSync(userExtRuleFile, path.join(fakeClaude, 'rules', 'user-ext-link.md'));
      fs.writeFileSync(
        path.join(fakeClaude, 'rules', 'user-scoped.md'),
        `---\npaths:\n  - "subpkg/**/*.ts"\n---\n@${styleFile}\nUSER_SCOPED_OK\n`,
      );

      // Repo A: intra-workspace safe links + untrusted external imports/symlinks
      fs.writeFileSync(path.join(wsA, 'docs', 'inner.md'), `@${secretFile}\nINNER_DOC_BODY\n`);
      fs.writeFileSync(path.join(wsA, 'docs', 'local-rule.md'), 'INTRA_WS_SYMLINK_RULE\n');
      fs.symlinkSync(secretFile, path.join(wsA, 'docs', 'sym-to-secret.md'));
      fs.writeFileSync(
        path.join(wsA, 'CLAUDE.md'),
        [
          '# Repo A',
          `@${styleFile}`,
          '@docs/inner.md',
          '@docs/sym-to-secret.md',
          '@/components/Button',
          'REPO_A_SAFE_BODY',
        ].join('\n') + '\n',
      );
      fs.writeFileSync(path.join(wsA, 'CLAUDE.local.md'), `@${secretFile}\nLOCAL_SAFE_BODY\n`);
      fs.symlinkSync(
        path.join(wsA, 'docs', 'local-rule.md'),
        path.join(wsA, '.claude', 'rules', 'intra-link.md'),
      );
      fs.symlinkSync(sharedRuleFile, path.join(wsA, '.claude', 'rules', 'ext-link.md'));
      fs.symlinkSync(extDir, path.join(wsA, '.claude', 'rules', 'ext-dir'));
      fs.writeFileSync(path.join(wsA, 'subpkg', 'CLAUDE.md'), `@${secretFile}\nSUBPKG_SAFE\n`);
      fs.writeFileSync(path.join(wsA, 'subpkg', 'app.ts'), 'export const a = 1;\n');

      // Repo B tries cross-workspace import into Repo A
      fs.writeFileSync(path.join(wsA, 'private.md'), 'WS_A_PRIVATE_CONTENT\n');
      fs.writeFileSync(path.join(wsB, 'CLAUDE.md'), `@../repo-a/private.md\nREPO_B_BODY\n`);

      // 1. Default fail-closed check
      const initial = loadClaudeRulesForWorkspaces([wsA, wsB], {
        claudeConfigDir: fakeClaude,
        deduplicateNativeAgentsMd: true,
      });

      const globalText = initial.globalAlwaysOn.map((r) => r.content).join('\n');
      assert.ok(globalText.includes('EXT_STYLE_CONTENT'));
      assert.ok(globalText.includes('USER_EXT_SYMLINK_CONTENT'));
      assert.equal(initial.globalConditional.length, 1);

      const lazyUser = loadConditionalRuleContentWithDiagnostics(
        path.join(fakeClaude, 'rules', 'user-scoped.md'),
        wsA,
        'user_rule',
        { claudeConfigDir: fakeClaude },
      );
      assert.ok(lazyUser.entry?.content.includes('EXT_STYLE_CONTENT'));
      assert.equal(lazyUser.blocked.length, 0);

      const bundleA = initial.workspaces.find((w) => w.workspaceRoot === path.resolve(wsA))!;
      const repoAText = bundleA.alwaysOn.map((r) => r.content).join('\n');
      assert.ok(repoAText.includes('REPO_A_SAFE_BODY'));
      assert.ok(repoAText.includes('INNER_DOC_BODY'));
      assert.ok(repoAText.includes('INTRA_WS_SYMLINK_RULE'));
      assert.ok(repoAText.includes('LOCAL_SAFE_BODY'));
      assert.ok(!repoAText.includes('EXT_STYLE_CONTENT'));
      assert.ok(!repoAText.includes('EXT_SHARED_RULE_CONTENT'));
      assert.ok(!repoAText.includes('EXT_SECRET_CONTENT'));
      assert.ok(bundleA.blockedExternalTargets.length >= 4);

      const bundleB = initial.workspaces.find((w) => w.workspaceRoot === path.resolve(wsB))!;
      assert.ok(!bundleB.alwaysOn.map((r) => r.content).join('\n').includes('WS_A_PRIVATE_CONTENT'));
      assert.equal(bundleB.blockedExternalTargets.length, 1);

      const subRes = findSubdirectoryClaudeMdsWithDiagnostics(
        path.join(wsA, 'subpkg', 'app.ts'),
        wsA,
        { claudeConfigDir: fakeClaude },
      );
      assert.equal(subRes.entries.length, 1);
      assert.ok(!subRes.entries[0].content.includes('EXT_SECRET_CONTENT'));
      assert.equal(subRes.blocked.length, 1);

      // 2. Target-scoped allowlist approves exact file only
      const afterFileAllow = updateWorkspaceExternalTrust(wsA, 'allow', styleFile, pluginData);
      const loadedFileAllow = loadClaudeRulesForWorkspaces([wsA], {
        claudeConfigDir: fakeClaude,
        externalRuleTrust: afterFileAllow.config.externalRuleTrust,
      });
      const textAfterFileAllow = loadedFileAllow.workspaces[0].alwaysOn
        .map((r) => r.content)
        .join('\n');
      assert.ok(textAfterFileAllow.includes('EXT_STYLE_CONTENT'));
      assert.ok(!textAfterFileAllow.includes('EXT_SHARED_RULE_CONTENT'));
      assert.ok(!textAfterFileAllow.includes('EXT_SECRET_CONTENT'));

      // 3. Directory prefix allowlist still blocks escape symlink pointing outside approved dir
      const afterDirAllow = updateWorkspaceExternalTrust(wsA, 'allow', extDir, pluginData);
      const loadedDirAllow = loadClaudeRulesForWorkspaces([wsA], {
        claudeConfigDir: fakeClaude,
        externalRuleTrust: afterDirAllow.config.externalRuleTrust,
      });
      const textAfterDirAllow = loadedDirAllow.workspaces[0].alwaysOn
        .map((r) => r.content)
        .join('\n');
      assert.ok(textAfterDirAllow.includes('EXT_STYLE_CONTENT'));
      assert.ok(textAfterDirAllow.includes('EXT_SHARED_RULE_CONTENT'));
      assert.ok(!textAfterDirAllow.includes('EXT_SECRET_CONTENT'));

      // 4. Native Claude Code .claude.json interop (read-only) + plugin deny override
      fs.writeFileSync(
        path.join(fakeClaude, '.claude.json'),
        JSON.stringify({
          projects: {
            [path.resolve(wsA)]: {
              hasClaudeMdExternalIncludesApproved: true,
              hasClaudeMdExternalIncludesWarningShown: true,
            },
            [path.resolve(wsB)]: {
              hasClaudeMdExternalIncludesApproved: false,
              hasClaudeMdExternalIncludesWarningShown: true,
            },
          },
        }),
      );
      const ccStateA = readClaudeCodeExternalApproval(wsA, { claudeConfigDir: fakeClaude });
      assert.equal(ccStateA?.approved, true);

      const cleared = updateWorkspaceExternalTrust(wsA, 'clear_workspace', undefined, pluginData);
      assert.equal(cleared.trust.allowPaths.length, 0);
      const afterDeny = updateWorkspaceExternalTrust(wsA, 'deny', secretFile, pluginData);
      const loadedDenyOverride = loadClaudeRulesForWorkspaces([wsA, wsB], {
        claudeConfigDir: fakeClaude,
        trustClaudeCodeExternalApprovals: true,
        externalRuleTrust: afterDeny.config.externalRuleTrust,
      });
      const denyText = loadedDenyOverride.workspaces[0].alwaysOn.map((r) => r.content).join('\n');
      assert.ok(denyText.includes('EXT_STYLE_CONTENT'));
      assert.ok(!denyText.includes('EXT_SECRET_CONTENT'));
      assert.equal(
        loadedDenyOverride.workspaces[1].blockedExternalTargets[0]?.status,
        'denied_by_claude_code',
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks symlinked root CLAUDE.md/.claude/rules and allows same-repo monorepo ancestor imports while blocking external ones', () => {
    const root = mkTempDir('um-dsh-monorepo-');
    try {
      const fakeClaude = path.join(root, '.claude-global');
      const outside = path.join(root, 'outside');
      const mono = path.join(root, 'monorepo');
      const appPkg = path.join(mono, 'packages', 'app');
      const symWs = path.join(root, 'sym-repo');

      fs.mkdirSync(fakeClaude, { recursive: true });
      fs.mkdirSync(outside, { recursive: true });
      fs.mkdirSync(path.join(mono, 'docs'), { recursive: true });
      fs.mkdirSync(appPkg, { recursive: true });
      fs.mkdirSync(symWs, { recursive: true });

      const extSecret = path.join(outside, 'secret.md');
      fs.writeFileSync(extSecret, 'OUTSIDE_MONO_SECRET\n');
      fs.writeFileSync(path.join(mono, 'docs', 'arch.md'), 'SAME_MONO_ARCH_DOC\n');
      fs.writeFileSync(
        path.join(mono, 'CLAUDE.md'),
        `@docs/arch.md\n@${extSecret}\nMONO_ROOT_RULE\n`,
      );
      fs.writeFileSync(path.join(appPkg, 'CLAUDE.md'), 'APP_PKG_RULE\n');

      execFileSync('git', ['init', '-b', 'main'], { cwd: mono, stdio: 'ignore' });

      fs.symlinkSync(extSecret, path.join(symWs, 'CLAUDE.md'));
      fs.mkdirSync(path.join(symWs, '.claude'), { recursive: true });
      fs.symlinkSync(outside, path.join(symWs, '.claude', 'rules'));

      const loaded = loadClaudeRulesForWorkspaces([appPkg, symWs], {
        claudeConfigDir: fakeClaude,
      });

      const monoBundle = loaded.workspaces.find((w) => w.workspaceRoot === path.resolve(appPkg))!;
      const monoText = monoBundle.alwaysOn.map((r) => r.content).join('\n');
      assert.ok(monoText.includes('SAME_MONO_ARCH_DOC'));
      assert.ok(monoText.includes('MONO_ROOT_RULE'));
      assert.ok(monoText.includes('APP_PKG_RULE'));
      assert.ok(!monoText.includes('OUTSIDE_MONO_SECRET'));
      assert.equal(monoBundle.blockedExternalTargets.length, 1);

      const symBundle = loaded.workspaces.find((w) => w.workspaceRoot === path.resolve(symWs))!;
      assert.equal(symBundle.alwaysOn.length, 0);
      assert.ok(
        symBundle.blockedExternalTargets.some(
          (b) => b.kind === 'external_rule_symlink' && b.sourceDisplayPath === 'CLAUDE.md',
        ),
      );
      assert.ok(
        symBundle.blockedExternalTargets.some(
          (b) => b.kind === 'external_rule_dir_symlink' && b.sourceDisplayPath === '.claude/rules',
        ),
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('Codex CLI read-only memory adapter (memories_v2 + v1 + path jail + CJK search)', () => {
  it('prefers memories_v2, strips v1 header, blocks disallowed paths, and searches Latin + CJK queries', () => {
    const root = mkTempDir('um-dsh-codex-');
    try {
      fs.mkdirSync(path.join(root, 'memories_v2', 'rollout_summaries'), { recursive: true });
      fs.mkdirSync(path.join(root, 'memories_v2', 'extensions', 'ad_hoc'), { recursive: true });
      fs.mkdirSync(path.join(root, 'memories'), { recursive: true });

      fs.writeFileSync(
        path.join(root, 'config.toml'),
        '[features]\nmemories = true\n\n[memories]\ngenerate_memories = true\nuse_memories = true\n',
      );
      fs.writeFileSync(
        path.join(root, 'memories', 'memory_summary.md'),
        'v1\n\n## User Profile\nOld v1 summary\n',
      );
      fs.writeFileSync(
        path.join(root, 'memories', 'MEMORY.md'),
        '# Handbook\n\n## 缓存策略\n本地数据库查询优先使用缓存层，禁止在集成测试中 Mock。\n',
      );
      fs.writeFileSync(
        path.join(root, 'memories_v2', 'memory_summary.md'),
        'v1\n\n## User Profile\nFresh v2 summary\n',
      );
      fs.writeFileSync(
        path.join(root, 'memories_v2', 'rollout_summaries', '2026-11-24-auth-fix.md'),
        '# Auth Fix\nResolved token refresh race condition in my-app.\n',
      );
      fs.writeFileSync(
        path.join(root, 'memories_v2', 'rollout_summaries', '2026-11-25-db-migration.md'),
        '# 数据库迁移记录\n使用 Prisma 执行数据库版本迁移前必须先备份 SQLite 文件。\n',
      );
      fs.writeFileSync(
        path.join(root, 'memories_v2', 'extensions', 'ad_hoc', 'instructions.md'),
        'Always double-check release tags.\n',
      );

      const status = getCodexMemoryStatus(root);
      assert.equal(status.activeGeneration, 'v2');
      assert.equal(status.configFlags.featuresMemories, true);
      assert.equal(status.configFlags.useMemories, true);
      assert.equal(status.v2.rolloutCount, 2);
      assert.deepEqual(status.v2.extensionFiles, ['extensions/ad_hoc/instructions.md']);

      const sum = readCodexSummary({ codexHome: root });
      assert.equal(sum.generation, 'v2');
      assert.ok(sum.content.startsWith('## User Profile'));
      assert.equal(stripCodexVersionHeader('v1\n\nHello'), 'Hello');

      // Latin search
      const hits = searchCodexMemories('token refresh', { codexHome: root, projectHint: 'my-app' });
      assert.ok(hits.length >= 1);
      assert.equal(hits[0].generation, 'v2');
      assert.equal(hits[0].category, 'rollout');

      // CJK full-width punctuation splitting & bigram fallback search
      const tokenized = tokenizeQuery('数据库，缓存配置');
      assert.ok(tokenized.exact.includes('数据库'));
      assert.ok(tokenized.exact.includes('缓存配置'));
      assert.ok(tokenized.bigrams.includes('缓存'));

      const zhHits = searchCodexMemories('数据库迁移规范', { codexHome: root });
      assert.ok(zhHits.length >= 1);
      assert.ok(zhHits[0].relativePath.includes('db-migration.md'));

      const zhPunctHits = searchCodexMemories('集成测试，缓存层', { codexHome: root });
      assert.ok(zhPunctHits.some((h) => h.category === 'handbook'));

      // Security path jail checks (lexical traversal, disallowed files, nested .git, sqlite-wal/shm/db, and symlink escapes)
      assert.throws(() => readCodexMemoryFile('v2', '../config.toml', root));
      assert.throws(() => readCodexMemoryFile('v1', 'raw_memories.md', root));
      assert.throws(() => readCodexMemoryFile('v2', '.git/HEAD', root));
      assert.throws(() => readCodexMemoryFile('v2', 'rollout_summaries/.git/config', root));
      assert.throws(() => readCodexMemoryFile('v2', 'state.sqlite', root));
      assert.throws(() => readCodexMemoryFile('v2', 'state.sqlite-wal', root));
      assert.throws(() => readCodexMemoryFile('v2', 'state.sqlite-shm', root));
      assert.throws(() => readCodexMemoryFile('v2', 'cache.db', root));

      // Symlink escape inside memories_v2 must be blocked in readCodexMemoryFile, readCodexSummary, and searchCodexMemories
      const outsideSecret = path.join(root, 'outside-secret.txt');
      fs.writeFileSync(outsideSecret, 'TOP_SECRET_OUTSIDE_CODEX_999\n');
      fs.writeFileSync(path.join(root, 'memories_v2', 'raw_memories.md'), 'RAW_MEMORIES_INTERNAL\n');
      fs.symlinkSync(
        outsideSecret,
        path.join(root, 'memories_v2', 'rollout_summaries', 'escape-link.md'),
      );
      fs.symlinkSync(
        path.join(root, 'memories_v2', 'raw_memories.md'),
        path.join(root, 'memories_v2', 'rollout_summaries', 'raw-alias.md'),
      );
      assert.throws(() => readCodexMemoryFile('v2', 'rollout_summaries/escape-link.md', root));
      assert.throws(() => readCodexMemoryFile('v2', 'rollout_summaries/raw-alias.md', root));

      const leakHits = searchCodexMemories('TOP_SECRET_OUTSIDE_CODEX_999', { codexHome: root });
      assert.equal(leakHits.length, 0);

      // Replace memory_summary.md with a symlink escaping memories_v2 -> readCodexSummary returns empty
      fs.unlinkSync(path.join(root, 'memories_v2', 'memory_summary.md'));
      fs.symlinkSync(outsideSecret, path.join(root, 'memories_v2', 'memory_summary.md'));
      const escapedSum = readCodexSummary({ codexHome: root, generation: 'v2' });
      assert.equal(escapedSum.content, '');
      assert.throws(() => readCodexMemoryFile('v2', 'memory_summary.md', root));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects symlinks escaping Claude memoryDir for both topic files and MEMORY.md', () => {
    const root = mkTempDir('um-dsh-claude-sym-');
    try {
      const memDir = path.join(root, 'memory');
      const outsideFile = path.join(root, 'outside.md');
      fs.mkdirSync(memDir, { recursive: true });
      fs.writeFileSync(outsideFile, '# Secret Outside File\n');
      fs.symlinkSync(outsideFile, path.join(memDir, 'escape-topic.md'));
      fs.symlinkSync(outsideFile, path.join(memDir, 'MEMORY.md'));

      assert.throws(() => readMemoryIndex(memDir), /Symlink escapes memory directory/);
      assert.throws(() => readTopicMemory(memDir, 'escape-topic.md'), /Symlink escapes memory directory/);
      assert.throws(() => writeMemoryIndexRaw(memDir, '# overwrite'), /Symlink escapes memory directory/);
      assert.throws(() => deleteTopicMemory(memDir, 'escape-topic.md'), /Symlink escapes memory directory/);
      assert.throws(
        () =>
          saveTopicMemory(memDir, {
            filename: 'escape-topic.md',
            name: 'escape',
            description: 'should block',
            type: 'project',
            body: 'blocked',
          }),
        /Symlink escapes memory directory/,
      );
      // Outside file must remain untouched
      assert.equal(fs.readFileSync(outsideFile, 'utf8'), '# Secret Outside File\n');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('DSH session state, $DSH_HOME data dir, locale config & diagnostics', () => {
  it('resolves data dir with DSH_HOME precedence and persists normalized locale config & sessions', () => {
    const root = mkTempDir('um-dsh-state-');
    try {
      const fakeDshHome = path.join(root, 'dsh-home');
      const customDataDir = path.join(root, 'custom-data');

      const fromDshHome = resolvePluginDataDir({ DSH_HOME: fakeDshHome });
      assert.equal(fromDshHome, path.join(fakeDshHome, 'storages', 'unified-memory'));
      assert.ok(fs.existsSync(fromDshHome));

      const fromOverride = resolvePluginDataDir({
        DSH_HOME: fakeDshHome,
        UNIFIED_MEMORY_DATA_DIR: customDataDir,
      });
      assert.equal(fromOverride, customDataDir);

      // Default config & locale normalization ('zh-CN' -> 'zh')
      const defCfg = loadPluginConfig(customDataDir);
      assert.equal(defCfg.locale, 'auto');
      assert.equal(defCfg.injectCodexSummaryOnStart, true);

      const savedCfg = savePluginConfig(
        { locale: 'zh-CN' as unknown as 'zh', codexSummaryMaxBytes: 16384 },
        customDataDir,
      );
      assert.equal(savedCfg.locale, 'zh');
      assert.equal(savedCfg.codexSummaryMaxBytes, 16384);
      assert.equal(loadPluginConfig(customDataDir).locale, 'zh');

      // Session state persistence + DSH replaceGeneration compaction detection
      const state = createEmptySessionState('sess-dsh-1', ['/tmp/proj']);
      state.sessionStarted = true;
      state.locale = 'zh';
      state.lastReplaceGeneration = 0;
      state.lastBaselineCwd = '/tmp/proj';
      state.hostDedupedPaths = ['/tmp/proj/CLAUDE.md'];
      saveSessionState(state, customDataDir);

      const loaded = loadSessionState('sess-dsh-1', customDataDir);
      assert.ok(loaded);
      assert.equal(loaded.locale, 'zh');
      assert.equal(loaded.lastReplaceGeneration, 0);
      assert.deepEqual(loaded.hostDedupedPaths, ['/tmp/proj/CLAUDE.md']);

      assert.equal(detectCompaction(loaded, { replaceGeneration: 0 }).compacted, false);
      assert.equal(detectCompaction(loaded, { replaceGeneration: 1 }).compacted, true);

      assert.equal(listRecentSessions(customDataDir).length, 1);

      // Diagnostics append/read/clear
      appendDiagnosticEvent(
        {
          ts: new Date().toISOString(),
          event: 'agent/pre-step',
          conversationId: 'sess-dsh-1',
          elapsedMs: 4.2,
          workspacePaths: ['/tmp/proj'],
          cwd: '/tmp/proj',
          locale: 'zh',
          hostDedupedCount: 1,
          injectedCount: 1,
          injectedLabels: ['claude-memory:test'],
        },
        customDataDir,
      );
      const events = readDiagnosticEvents(customDataDir);
      assert.equal(events.length, 1);
      assert.equal(events[0].locale, 'zh');
      assert.equal(events[0].hostDedupedCount, 1);

      clearDiagnosticEvents(customDataDir);
      assert.equal(readDiagnosticEvents(customDataDir).length, 0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
