import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Context } from '@deepseek-ai/cordis';
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent';
import type { UserMessage } from '@deepseek-ai/dsh-llm';
import type { SessionEvent, SessionId, SessionSeq } from '@deepseek-ai/dsh-session';
import type { ToolExecution, ToolExecutionResult, ToolExecutionToken } from '@deepseek-ai/dsh-tools';
import { API_PATHS } from '../src/shared/api-contract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');
const HOST_BUNDLE_PATH = path.join(PKG_ROOT, 'lib', 'index.js');

function resolveDshPackage(pkgName: string): string | null {
  const candidates = [
    path.join(PKG_ROOT, 'node_modules', pkgName),
    path.join(process.env.DSH_TEST_PKG_DIR || '/tmp/dsh-test/pkg', 'node_modules', pkgName),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
  }
  return null;
}

const REQUIRED_DSH_PACKAGES = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-llm',
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-session-projection',
  '@deepseek-ai/dsh-session-persistence-jsonl',
  '@deepseek-ai/dsh-agent',
  '@deepseek-ai/dsh-agent-loop',
  '@deepseek-ai/dsh-tools',
  '@deepseek-ai/dsh-tool-executor-native',
  '@deepseek-ai/dsh-fs-local',
  '@deepseek-ai/dsh-working-directory',
  '@deepseek-ai/dsh-commands',
  '@deepseek-ai/dsh-skill',
  '@deepseek-ai/dsh-system-prompt',
  '@deepseek-ai/dsh-agent-instructions',
  '@deepseek-ai/dsh-credentials-local',
  '@deepseek-ai/dsh-client-connection',
] as const;

const HAS_REAL_DSH_RUNTIME = REQUIRED_DSH_PACKAGES.every((p) => resolveDshPackage(p) !== null);

async function importDsh<T = Record<string, any>>(pkgName: string): Promise<T> {
  const dir = resolveDshPackage(pkgName);
  if (!dir) throw new Error(`DSH package not found: ${pkgName}`);
  return (await import(pathToFileURL(path.join(dir, 'lib', 'index.js')).href)) as T;
}

interface EnvSnapshot {
  HOME?: string;
  DSH_HOME?: string;
  CLAUDE_CONFIG_DIR?: string;
  CODEX_HOME?: string;
  CLAUDE_CODE_DISABLE_AUTO_MEMORY?: string;
  LC_ALL?: string;
  LANG?: string;
}

function captureEnv(): EnvSnapshot {
  return {
    HOME: process.env.HOME,
    DSH_HOME: process.env.DSH_HOME,
    CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
    CODEX_HOME: process.env.CODEX_HOME,
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY,
    LC_ALL: process.env.LC_ALL,
    LANG: process.env.LANG,
  };
}

function restoreEnv(snap: EnvSnapshot): void {
  for (const [k, v] of Object.entries(snap)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

interface TestSandbox {
  root: string;
  homeDir: string;
  dshHome: string;
  claudeConfigDir: string;
  codexHome: string;
  dataDir: string;
  repoDir: string;
  externalSecretPath: string;
  cleanup: () => void;
}

function createSandbox(): TestSandbox {
  const envSnap = captureEnv();
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'um-dsh-e2e-')));
  const homeDir = path.join(root, 'home');
  const dshHome = path.join(root, 'dsh-home');
  const claudeConfigDir = path.join(homeDir, '.claude');
  const codexHome = path.join(homeDir, '.codex');
  const dataDir = path.join(dshHome, 'data', 'unified-memory');
  const repoDir = path.join(root, 'workspace', 'demo-repo');
  const externalDir = path.join(root, 'outside-secret');
  const externalSecretPath = path.join(externalDir, 'secret-rules.md');

  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(dshHome, { recursive: true });
  fs.mkdirSync(claudeConfigDir, { recursive: true });
  fs.mkdirSync(path.join(codexHome, 'memories_v2', 'rollout_summaries'), { recursive: true });
  fs.mkdirSync(repoDir, { recursive: true });
  execFileSync('git', ['init', '-q', repoDir], { stdio: 'ignore' });
  fs.mkdirSync(externalDir, { recursive: true });
  fs.writeFileSync(externalSecretPath, 'SECRET_EXTERNAL_CONTENT_DO_NOT_LEAK\n', 'utf8');

  process.env.HOME = homeDir;
  process.env.DSH_HOME = dshHome;
  process.env.CLAUDE_CONFIG_DIR = claudeConfigDir;
  process.env.CODEX_HOME = codexHome;
  delete process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY;
  process.env.LC_ALL = 'en_US.UTF-8';
  process.env.LANG = 'en_US.UTF-8';

  return {
    root,
    homeDir,
    dshHome,
    claudeConfigDir,
    codexHome,
    dataDir,
    repoDir,
    externalSecretPath,
    cleanup: () => {
      restoreEnv(envSnap);
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

interface HarnessOptions {
  sandbox: TestSandbox;
  locale?: 'auto' | 'zh' | 'en';
  withAgentInstructions?: boolean;
  withConnection?: boolean;
  withSettings?: boolean;
  hostLocalePref?: string;
  headlessMinimal?: boolean;
}

interface LiveHarness {
  ctx: Context;
  agentEvents: (ctx: Context, agent: Agent) => any;
  createUserMessage: (input: { content: any[]; source: any }) => UserMessage;
  buildForkSeed: (events: readonly SessionEvent[], boundary: SessionSeq) => SessionEvent[];
  SessionSeq: (n: number) => SessionSeq;
  SessionId: (s: string) => SessionId;
  setHostLocale: (lang: string) => void;
  umFiber: any;
  dispose: () => Promise<void>;
}

async function bootHarness(opts: HarnessOptions): Promise<LiveHarness> {
  const { Context: CordisContext, Service } = await importDsh('@deepseek-ai/cordis');
  const LlmMod = await importDsh('@deepseek-ai/dsh-llm');
  const SessionMod = await importDsh('@deepseek-ai/dsh-session');
  const ProjectionMod = await importDsh('@deepseek-ai/dsh-session-projection');
  const PersistenceMod = await importDsh('@deepseek-ai/dsh-session-persistence-jsonl');
  const AgentMod = await importDsh('@deepseek-ai/dsh-agent');
  const AgentLoopMod = await importDsh('@deepseek-ai/dsh-agent-loop');
  const ToolsMod = await importDsh('@deepseek-ai/dsh-tools');
  const NativeExecMod = await importDsh('@deepseek-ai/dsh-tool-executor-native');
  const FsMod = await importDsh('@deepseek-ai/dsh-fs-local');
  const WdMod = await importDsh('@deepseek-ai/dsh-working-directory');
  const CommandsMod = await importDsh('@deepseek-ai/dsh-commands');
  const SkillMod = await importDsh('@deepseek-ai/dsh-skill');
  const SystemPromptMod = await importDsh('@deepseek-ai/dsh-system-prompt');
  const AgentInstructionsMod = await importDsh('@deepseek-ai/dsh-agent-instructions');
  const CredentialsMod = await importDsh('@deepseek-ai/dsh-credentials-local');
  const ConnectionMod = await importDsh('@deepseek-ai/dsh-client-connection');
  const UnifiedMemoryPlugin = await import(pathToFileURL(HOST_BUNDLE_PATH).href);

  const ctx = new CordisContext() as Context;
  ctx.plugin(LlmMod.default);
  ctx.plugin(SessionMod.default);
  ctx.plugin(ProjectionMod.default);
  ctx.plugin(PersistenceMod as any, { root: path.join(opts.sandbox.dshHome, 'sessions') });
  ctx.plugin(AgentMod.default);
  ctx.plugin(ToolsMod.default);
  ctx.plugin(NativeExecMod.default ?? NativeExecMod);
  ctx.plugin(FsMod.default);
  ctx.plugin(WdMod.default);
  ctx.plugin(AgentLoopMod.default);

  let hostLocale = opts.hostLocalePref ?? 'en';

  if (!opts.headlessMinimal) {
    ctx.plugin(CommandsMod.default);
    ctx.plugin(SkillMod.default);
  }
  ctx.plugin(SystemPromptMod.default);

  if (opts.withSettings) {
    class MockSettingsService extends Service {
      constructor(c: Context) {
        super(c, 'settings');
      }
      describe() {
        return [{ ns: 'locale', value: { preference: hostLocale } }];
      }
    }
    ctx.plugin(MockSettingsService);
  }

  if (opts.withConnection) {
    ctx.plugin(CredentialsMod.default ?? CredentialsMod);
    ctx.plugin(ConnectionMod as any, { trustedHosts: [] });
  }

  if (opts.withAgentInstructions) {
    ctx.plugin(AgentInstructionsMod as any, { maxBytes: 32768 });
  }

  const umFiber = ctx.plugin(UnifiedMemoryPlugin, {
    locale: opts.locale ?? 'auto',
    dataDir: opts.sandbox.dataDir,
  });

  // Allow Cordis fibers & async service providers (e.g. BrowserAuth) to settle
  await new Promise((r) => setTimeout(r, 150));

  return {
    ctx,
    agentEvents: AgentMod.agentEvents,
    createUserMessage: LlmMod.createUserMessage,
    buildForkSeed: SessionMod.buildForkSeed,
    SessionSeq: SessionMod.SessionSeq,
    SessionId: SessionMod.SessionId,
    setHostLocale: (lang: string) => {
      hostLocale = lang;
    },
    umFiber,
    dispose: async () => {
      await ctx.fiber.dispose();
    },
  };
}

async function runPreStep(
  harness: LiveHarness,
  agent: Agent,
  userText: string,
  step: number,
  commitToSession = true,
): Promise<PreStepDecision> {
  const userMsg = harness.createUserMessage({
    content: [{ type: 'text', text: userText }],
    source: { kind: 'human' },
  });
  const decision = (await harness.agentEvents(harness.ctx, agent).waterfall(
    'agent/pre-step',
    {
      messages: [userMsg],
      step,
      signal: new AbortController().signal,
    },
    () => ({ kind: 'enter' as const, messages: [userMsg] }),
  )) as PreStepDecision;

  if (commitToSession && decision.kind === 'enter' && decision.messages.length > 0) {
    const batch = decision.messages.map(
      (m) => ['user/message', m, { surfaceOp: 'append' }] as const,
    );
    agent.session.append(batch as any);
  }
  return decision;
}

function textOfMessage(msg: UserMessage): string {
  return (msg.content ?? [])
    .filter((b: any) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b: any) => b.text)
    .join('\n');
}

describe('Unified Memory DSH — Real Cordis v4 Host E2E Suite', () => {
  it('1. Full host boot: registers all 9 tools, static systemPrompt guidance (interpolate:false), bundled skills, Chinese topic CRUD, and Codex symlink/traversal jail', async (t) => {
    if (!HAS_REAL_DSH_RUNTIME) {
      t.skip('Real @deepseek-ai/dsh packages not available');
      return;
    }

    const sandbox = createSandbox();
    // Populate Codex v2 memory + an adversarial symlink escape
    fs.writeFileSync(
      path.join(sandbox.codexHome, 'memories_v2', 'memory_summary.md'),
      '# Codex Summary\n数据库迁移使用 Alembic，禁止跳过 preflight 检查。\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(sandbox.codexHome, 'memories_v2', 'rollout_summaries', '2026-db.md'),
      '# DB Migration Rollout\n数据库迁移回滚步骤：先暂停写入再恢复快照。\n',
      'utf8',
    );
    fs.symlinkSync(
      sandbox.externalSecretPath,
      path.join(sandbox.codexHome, 'memories_v2', 'rollout_summaries', 'escape.md'),
    );
    // Populate workspace rule with blocked external import
    fs.writeFileSync(
      path.join(sandbox.repoDir, 'CLAUDE.md'),
      `# Project Rules\n@${sandbox.externalSecretPath}\n`,
      'utf8',
    );

    const harness = await bootHarness({ sandbox, locale: 'en' });
    try {
      assert.equal(harness.umFiber.state, 2, 'unified-memory-dsh fiber must be ACTIVE');

      // 1a. Verify all 9 tools registered
      const toolNames = harness.ctx.tools
        .definitions()
        .map((d: any) => d.name)
        .sort();
      assert.deepEqual(toolNames, [
        'claude_memory_delete',
        'claude_memory_list',
        'claude_memory_read',
        'claude_memory_save',
        'claude_memory_status',
        'claude_rules_inspect',
        'codex_memory_read',
        'codex_memory_search',
        'codex_memory_summary',
      ]);

      // 1b. Verify static systemPrompt guidance section (interpolate: false)
      const assembled = await harness.ctx.systemPrompt.assemble({
        context: { variables: { model: 'deepseek-test' } },
      } as any);
      const guidanceSection = assembled.sections.find(
        (s) => s.name === 'unified-memory:guidance',
      );
      assert.ok(guidanceSection, 'Assembled system prompt must include unified-memory:guidance section');
      assert.equal(
        guidanceSection.interpolate,
        false,
        'unified-memory:guidance must set interpolate: false',
      );
      assert.ok(
        guidanceSection.text.includes('claude_memory_save'),
        'Guidance section must instruct model on unified-memory tools',
      );
      assert.ok(
        guidanceSection.text.includes('Skip saving on routine turns'),
        'Guidance section must guard against saving on routine turns',
      );
      assert.ok(
        guidanceSection.text.includes('record from failure AND success'),
        'Guidance section must cover both failure corrections and validated successes',
      );
      assert.ok(guidanceSection.text.includes('**Why:**'));
      assert.ok(guidanceSection.text.includes('**How to apply:**'));

      // 1c. Verify bundled skills registered
      const skills = await harness.ctx.skills.list();
      const skillNames = skills.map((s: any) => s.name).sort();
      assert.ok(skillNames.includes('memory-manage'));
      assert.ok(skillNames.includes('memory-dream'));
      const dreamSkill = await harness.ctx.skills.get('memory-dream');
      assert.ok(dreamSkill && dreamSkill.content.length > 50);

      // 1d. Create an agent bound to repoDir to execute all 9 tools
      const handle = await harness.ctx.agents.create({
        sessionId: harness.SessionId('sess-tools-1'),
        meta: { cwd: sandbox.repoDir },
      });
      const agent = handle.agent;

      const execTool = async (name: string, args: Record<string, unknown>) => {
        const def = harness.ctx.tools.get(name);
        assert.ok(def, `Tool ${name} must be registered`);
        const res = await (def as any).execute(args, {
          agent,
          signal: new AbortController().signal,
          cwd: sandbox.repoDir,
        });
        return typeof res === 'string' ? res : JSON.stringify(res);
      };

      // Pure-Chinese topic save -> list -> read -> status -> delete
      const saveOut = await execTool('claude_memory_save', {
        name: '部署规范与回滚策略',
        description: '生产环境灰度发布与一键回滚说明',
        type: 'project',
        body: '灰度发布前必须执行数据库备份与健康检查。',
      });
      const saveParsed = JSON.parse(saveOut);
      assert.equal(saveParsed.saved, true);
      assert.ok(
        typeof saveParsed.filename === 'string' && saveParsed.filename.endsWith('.md'),
      );

      const listOut = JSON.parse(await execTool('claude_memory_list', {}));
      assert.equal(listOut.topics.length, 1);
      assert.equal(listOut.topics[0].name, '部署规范与回滚策略');

      const readOut = JSON.parse(
        await execTool('claude_memory_read', { filename: saveParsed.filename }),
      );
      assert.ok((readOut.body ?? readOut.topic?.body ?? '').includes('健康检查'));

      const statusOut = JSON.parse(await execTool('claude_memory_status', {}));
      assert.equal(statusOut.topicCount, 1);

      const delOut = JSON.parse(
        await execTool('claude_memory_delete', { filename: saveParsed.filename }),
      );
      assert.equal(delOut.deleted, true);

      // Rules inspect detects blocked external import
      const inspectOut = JSON.parse(await execTool('claude_rules_inspect', {}));
      assert.ok(inspectOut.externalTrustSummary.pendingExternalApprovalCount >= 1);

      // Codex tools: summary + CJK search + valid read + path traversal & symlink escape BLOCKED
      const codexSummary = JSON.parse(await execTool('codex_memory_summary', {}));
      assert.equal(codexSummary.readOnly, true);
      assert.ok(codexSummary.summary.content.includes('Alembic'));

      const codexSearch = JSON.parse(
        await execTool('codex_memory_search', { query: '数据库迁移' }),
      );
      assert.ok(codexSearch.hits.length >= 1, 'CJK Codex search must return hits');

      const codexReadOk = JSON.parse(
        await execTool('codex_memory_read', {
          generation: 'v2',
          relativePath: 'rollout_summaries/2026-db.md',
        }),
      );
      assert.ok(codexReadOk.content.includes('回滚步骤'));

      await assert.rejects(
        () =>
          execTool('codex_memory_read', {
            generation: 'v2',
            relativePath: '../../etc/passwd',
          }),
        /escapes|unsafe|invalid|denied|outside|disallowed/i,
        'Codex path traversal must be rejected',
      );
      await assert.rejects(
        () =>
          execTool('codex_memory_read', {
            generation: 'v2',
            relativePath: 'rollout_summaries/escape.md',
          }),
        /escapes|symlink|outside|unsafe|disallowed/i,
        'Codex symlink escape must be rejected',
      );
    } finally {
      await harness.dispose();
      sandbox.cleanup();
    }
  });

  it('2. Exact dsh-agent-instructions dedup ({ prepend: true }) at repo root AND subdir cwd, @import expansion, external fail-closed, </system-reminder> escaping, and V4 source.kind', async (t) => {
    if (!HAS_REAL_DSH_RUNTIME) {
      t.skip('Real @deepseek-ai/dsh packages not available');
      return;
    }

    const sandbox = createSandbox();
    const docsDir = path.join(sandbox.repoDir, 'docs');
    const subDir = path.join(sandbox.repoDir, 'packages', 'sub');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.mkdirSync(subDir, { recursive: true });

    fs.writeFileSync(
      path.join(docsDir, 'extra.md'),
      'EXPANDED_LOCAL_IMPORT_MARKER\nAttempted break: </system-reminder> still safe.\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(sandbox.repoDir, 'CLAUDE.md'),
      `ROOT_CLAUDE_RAW_BODY_UNIQUE\n@./docs/extra.md\n@${sandbox.externalSecretPath}\n`,
      'utf8',
    );
    fs.writeFileSync(
      path.join(subDir, 'CLAUDE.md'),
      'SUBDIR_CLAUDE_RAW_BODY_UNIQUE\n',
      'utf8',
    );

    const harness = await bootHarness({
      sandbox,
      locale: 'en',
      withAgentInstructions: true,
    });

    try {
      // Test A: Root cwd
      const rootHandle = await harness.ctx.agents.create({
        sessionId: harness.SessionId('sess-dedup-root'),
        meta: { cwd: sandbox.repoDir },
      });
      const rootDecision = await runPreStep(harness, rootHandle.agent, 'hello root', 1);
      assert.equal(rootDecision.kind, 'enter');

      const hostIdx = rootDecision.messages.findIndex(
        (m: any) => m.source?.kind === 'agent-instructions',
      );
      const umIdx = rootDecision.messages.findIndex(
        (m: any) => m.source?.kind === 'unified-memory',
      );
      assert.ok(hostIdx > 0, 'dsh-agent-instructions must inject baseline message after user prompt');
      assert.ok(umIdx > 0, 'unified-memory must inject supplemental baseline after user prompt');

      // Never uses source.kind === 'plugin'
      for (const msg of rootDecision.messages as any[]) {
        assert.notEqual(msg.source?.kind, 'plugin');
      }

      const umText = textOfMessage(rootDecision.messages[umIdx]);
      assert.equal(
        umText.includes('ROOT_CLAUDE_RAW_BODY_UNIQUE'),
        false,
        'Raw CLAUDE.md body already loaded by host must NOT be duplicated',
      );
      assert.ok(
        umText.includes('EXPANDED_LOCAL_IMPORT_MARKER'),
        'Local @import from deduped CLAUDE.md MUST still be expanded',
      );
      assert.equal(
        umText.includes('SECRET_EXTERNAL_CONTENT_DO_NOT_LEAK'),
        false,
        'Untrusted external @import must fail closed',
      );
      // Verify </system-reminder> inside payload was escaped so there is only 1 closing tag
      const closeTagMatches = umText.match(/<\/system-reminder>/g) ?? [];
      assert.equal(closeTagMatches.length, 1, 'Inner </system-reminder> must be escaped');

      // Test B: Subdirectory cwd (P0 regression for relative baselineIdentity.projectRoot = "../..")
      const subHandle = await harness.ctx.agents.create({
        sessionId: harness.SessionId('sess-dedup-sub'),
        meta: { cwd: subDir },
      });
      const subDecision = await runPreStep(harness, subHandle.agent, 'hello subdir', 1);
      assert.equal(subDecision.kind, 'enter');

      const subHostMsg = subDecision.messages.find(
        (m: any) => m.source?.kind === 'agent-instructions',
      );
      const subUmMsg = subDecision.messages.find(
        (m: any) => m.source?.kind === 'unified-memory',
      );
      assert.ok(subHostMsg, 'dsh-agent-instructions must load root + subdir CLAUDE.md');
      assert.ok(subUmMsg, 'unified-memory must still inject expanded @import / pending notice');

      const subUmText = textOfMessage(subUmMsg);
      assert.equal(
        subUmText.includes('ROOT_CLAUDE_RAW_BODY_UNIQUE'),
        false,
        'Subdir cwd must NOT duplicate root CLAUDE.md already loaded by host',
      );
      assert.equal(
        subUmText.includes('SUBDIR_CLAUDE_RAW_BODY_UNIQUE'),
        false,
        'Subdir cwd must NOT duplicate subdir CLAUDE.md already loaded by host',
      );
      assert.ok(
        subUmText.includes('EXPANDED_LOCAL_IMPORT_MARKER'),
        'Subdir cwd must still expand @./docs/extra.md from root CLAUDE.md',
      );
    } finally {
      await harness.dispose();
      sandbox.cleanup();
    }
  });

  it('3. Minimal preset (no dsh-agent-instructions) bare CLAUDE.md takeover & empty-baseline non-repeat guard', async (t) => {
    if (!HAS_REAL_DSH_RUNTIME) {
      t.skip('Real @deepseek-ai/dsh packages not available');
      return;
    }

    const sandbox = createSandbox();
    fs.writeFileSync(
      path.join(sandbox.repoDir, 'CLAUDE.md'),
      'BARE_CLAUDE_TAKEOVER_BODY\n',
      'utf8',
    );
    const emptyRepo = path.join(sandbox.root, 'empty-workspace');
    fs.mkdirSync(path.join(emptyRepo, '.git'), { recursive: true });

    const harness = await bootHarness({
      sandbox,
      locale: 'en',
      withAgentInstructions: false,
    });

    try {
      // 3a. Takeover bare CLAUDE.md when host agent-instructions is absent
      const handle = await harness.ctx.agents.create({
        sessionId: harness.SessionId('sess-minimal-takeover'),
        meta: { cwd: sandbox.repoDir },
      });
      const d1 = await runPreStep(harness, handle.agent, 'hi', 1);
      assert.equal(d1.kind, 'enter');
      const umMsg = d1.messages.find((m: any) => m.source?.kind === 'unified-memory');
      assert.ok(umMsg, 'unified-memory must take over bare CLAUDE.md in minimal preset');
      assert.ok(textOfMessage(umMsg).includes('BARE_CLAUDE_TAKEOVER_BODY'));

      // 3b. Empty-baseline non-repeat guard (P1 regression)
      process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY = '1';
      const emptyHandle = await harness.ctx.agents.create({
        sessionId: harness.SessionId('sess-empty-baseline'),
        meta: { cwd: emptyRepo },
      });
      const e1 = await runPreStep(harness, emptyHandle.agent, 'turn 1', 1);
      const e2 = await runPreStep(harness, emptyHandle.agent, 'turn 2', 2);
      assert.equal(e1.kind, 'enter');
      assert.equal(e2.kind, 'enter');

      const diagPath = path.join(sandbox.dataDir, 'diagnostics.jsonl');
      const diagLines = fs
        .readFileSync(diagPath, 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l))
        .filter((ev) => ev.conversationId === 'sess-empty-baseline');
      assert.equal(
        diagLines.length,
        1,
        'Empty baseline must evaluate only once per (cwd, replaceGeneration), not loop every turn',
      );
    } finally {
      await harness.dispose();
      sandbox.cleanup();
    }
  });

  it('4. Step-2 lazy paths: rule & subdir CLAUDE.md injection via tools/result (read, edit, apply_patch) + step/end', async (t) => {
    if (!HAS_REAL_DSH_RUNTIME) {
      t.skip('Real @deepseek-ai/dsh packages not available');
      return;
    }

    const sandbox = createSandbox();
    const rulesDir = path.join(sandbox.repoDir, '.claude', 'rules');
    const apiDir = path.join(sandbox.repoDir, 'src', 'api');
    const billingDir = path.join(sandbox.repoDir, 'packages', 'billing');
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.mkdirSync(apiDir, { recursive: true });
    fs.mkdirSync(billingDir, { recursive: true });

    fs.writeFileSync(
      path.join(rulesDir, 'api-style.md'),
      '---\npaths:\n  - "src/api/**/*.ts"\n---\nLAZY_API_RULE_SENTINEL: Always validate DTO schemas.\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(billingDir, 'CLAUDE.md'),
      'LAZY_BILLING_SUBDIR_SENTINEL: Use integer cents for currency.\n',
      'utf8',
    );
    const apiFile = path.join(apiDir, 'orders.ts');
    const billingFile = path.join(billingDir, 'invoice.ts');
    fs.writeFileSync(apiFile, 'export const order = 1;\n', 'utf8');
    fs.writeFileSync(billingFile, 'export const cents = 100;\n', 'utf8');

    const harness = await bootHarness({ sandbox, locale: 'en' });
    try {
      const handle = await harness.ctx.agents.create({
        sessionId: harness.SessionId('sess-lazy-1'),
        meta: { cwd: sandbox.repoDir },
      });
      const agent = handle.agent;

      // Step 1: baseline should NOT contain lazy rule or subdir CLAUDE.md
      const s1 = await runPreStep(harness, agent, 'inspect code', 1);
      assert.equal(s1.kind, 'enter');
      const s1AllText = s1.messages.map(textOfMessage).join('\n');
      assert.equal(s1AllText.includes('LAZY_API_RULE_SENTINEL'), false);
      assert.equal(s1AllText.includes('LAZY_BILLING_SUBDIR_SENTINEL'), false);

      // Emit real tools/result for read (apiFile) and apply_patch (billingFile), then step/end
      const emitToolResult = (name: string, args: Record<string, unknown>) => {
        const exec: ToolExecution = {
          token: Symbol('exec') as unknown as ToolExecutionToken,
          name,
          arguments: args,
          agent,
          signal: new AbortController().signal,
        } as unknown as ToolExecution;
        const result: ToolExecutionResult = {
          output: 'ok',
          isError: false,
        } as unknown as ToolExecutionResult;
        harness.ctx.emit('tools/result' as any, exec, result);
      };

      emitToolResult('read', { file_path: apiFile });
      emitToolResult('apply_patch', {
        input: `*** Begin Patch\n*** Update File: ${path.relative(sandbox.repoDir, billingFile)}\n@@\n-export const cents = 100;\n+export const cents = 200;\n*** End Patch`,
      });
      // Also verify edit tool path extraction does not break or duplicate
      emitToolResult('edit', { file_path: apiFile });

      // Close step -> flushes staged touches into session pending queue
      agent.session.append('step/end', { turn: 1, step: 1 });

      // Step 2: lazy injection must deliver BOTH api-style.md AND packages/billing/CLAUDE.md
      const s2 = await runPreStep(harness, agent, 'continue', 2);
      assert.equal(s2.kind, 'enter');
      const lazyMsg = s2.messages.find(
        (m: any) => m.source?.kind === 'unified-memory' && m.source?.form === 'recall',
      );
      assert.ok(lazyMsg, 'Step 2 must inject lazy recall message');
      const lazyText = textOfMessage(lazyMsg);
      assert.ok(lazyText.includes('LAZY_API_RULE_SENTINEL'));
      assert.ok(lazyText.includes('LAZY_BILLING_SUBDIR_SENTINEL'));

      // Step 3: already-loaded lazy items must NOT be re-injected
      emitToolResult('read', { file_path: apiFile });
      agent.session.append('step/end', { turn: 1, step: 2 });
      const s3 = await runPreStep(harness, agent, 'step 3', 3);
      assert.equal(s3.kind, 'enter');
      const s3Lazy = s3.messages.find(
        (m: any) => m.source?.kind === 'unified-memory' && m.source?.form === 'recall',
      );
      assert.equal(s3Lazy, undefined, 'Already loaded lazy rules must not re-inject');
    } finally {
      await harness.dispose();
      sandbox.cleanup();
    }
  });

  it('5. Real /compact reload (replaceGeneration increment, lazy-rule reset, locale zh<->en switch) & dynamic cwd switch reload', async (t) => {
    if (!HAS_REAL_DSH_RUNTIME) {
      t.skip('Real @deepseek-ai/dsh packages not available');
      return;
    }

    const sandbox = createSandbox();
    const rulesDir = path.join(sandbox.repoDir, '.claude', 'rules');
    const apiDir = path.join(sandbox.repoDir, 'src', 'api');
    const repoB = path.join(sandbox.root, 'workspace', 'repo-b');
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.mkdirSync(apiDir, { recursive: true });
    fs.mkdirSync(path.join(repoB, '.git'), { recursive: true });

    fs.writeFileSync(path.join(sandbox.repoDir, 'CLAUDE.md'), 'REPO_A_BASELINE_RULE\n', 'utf8');
    fs.writeFileSync(
      path.join(rulesDir, 'api.md'),
      '---\npaths:\n  - "src/api/**/*.ts"\n---\nCOMPACT_RESET_RULE_MARKER\n',
      'utf8',
    );
    const apiFile = path.join(apiDir, 'handler.ts');
    fs.writeFileSync(apiFile, 'export {};\n', 'utf8');
    fs.writeFileSync(path.join(repoB, 'CLAUDE.md'), 'REPO_B_SWITCHED_RULE\n', 'utf8');

    const harness = await bootHarness({
      sandbox,
      locale: 'auto',
      withSettings: true,
      hostLocalePref: 'en',
    });

    try {
      const handle = await harness.ctx.agents.create({
        sessionId: harness.SessionId('sess-compact-1'),
        meta: { cwd: sandbox.repoDir },
      });
      const agent = handle.agent;

      // Step 1: baseline in 'en'
      const d1 = await runPreStep(harness, agent, 'start', 1);
      assert.equal(d1.kind, 'enter');
      const baseEn = d1.messages.find((m: any) => m.source?.kind === 'unified-memory') as any;
      assert.ok(baseEn);
      assert.equal(baseEn.source.locale, 'en');

      // Trigger lazy rule once before compaction
      harness.ctx.emit(
        'tools/result' as any,
        {
          token: Symbol('exec') as any,
          name: 'read',
          arguments: { file_path: apiFile },
          agent,
          signal: new AbortController().signal,
        },
        { output: 'ok', isError: false },
      );
      agent.session.append('step/end', { turn: 1, step: 1 });
      const d2 = await runPreStep(harness, agent, 'after read', 2);
      assert.equal(d2.kind, 'enter');
      assert.ok(d2.messages.some((m) => textOfMessage(m).includes('COMPACT_RESET_RULE_MARKER')));

      // Switch host UI locale to zh, then commit real V4 surface replacement (compaction)
      harness.setHostLocale('zh-CN');
      const surfaceNodes = [...agent.session.surface.nodes];
      assert.ok(surfaceNodes.length > 0);
      agent.session.append(
        'user/message',
        harness.createUserMessage({
          content: [{ type: 'text', text: '[Compacted conversation summary]' }],
          source: { kind: 'compaction' },
        }),
        {
          surfaceOp: {
            op: 'replace',
            startSeq: surfaceNodes[0],
            endSeq: surfaceNodes[surfaceNodes.length - 1],
          },
          sourceEventSeqs: surfaceNodes,
        },
      );
      assert.ok(
        agent.session.surface.replaceGeneration >= 1,
        'Compaction must increment surface.replaceGeneration',
      );

      // Step 3: post-compaction pre-step MUST reload baseline in 'zh' and reset lazy rules!
      const d3 = await runPreStep(harness, agent, 'after compact', 3);
      assert.equal(d3.kind, 'enter');
      const baseZh = d3.messages.find((m: any) => m.source?.kind === 'unified-memory') as any;
      assert.ok(baseZh, 'Compaction must trigger fresh baseline re-injection');
      assert.equal(baseZh.source.locale, 'zh', 'Post-compaction baseline must adopt updated zh locale');
      assert.equal(baseZh.source.replaceGeneration, agent.session.surface.replaceGeneration);

      // Touching apiFile again after compaction MUST re-inject api.md because lazy rules were reset!
      harness.ctx.emit(
        'tools/result' as any,
        {
          token: Symbol('exec2') as any,
          name: 'read',
          arguments: { file_path: apiFile },
          agent,
          signal: new AbortController().signal,
        },
        { output: 'ok', isError: false },
      );
      agent.session.append('step/end', { turn: 2, step: 1 });
      const d4 = await runPreStep(harness, agent, 're-read after compact', 4);
      assert.equal(d4.kind, 'enter');
      assert.ok(
        d4.messages.some((m) => textOfMessage(m).includes('COMPACT_RESET_RULE_MARKER')),
        'Lazy rule must re-trigger after compaction reset',
      );

      // Dynamic cwd switch -> must reload baseline for repoB
      await (harness.ctx.workingDirectory as any).set(agent, repoB);
      const d5 = await runPreStep(harness, agent, 'switched repo', 5);
      assert.equal(d5.kind, 'enter');
      const switchedBase = d5.messages.find((m: any) => m.source?.kind === 'unified-memory');
      assert.ok(switchedBase, 'Dynamic cwd switch must trigger baseline reload');
      assert.ok(textOfMessage(switchedBase).includes('REPO_B_SWITCHED_RULE'));
    } finally {
      await harness.dispose();
      sandbox.cleanup();
    }
  });

  it('6. subagent_fork (isSeeded: true) KV-cache skip & real V4 persistence ctx.agents.resume() validation', async (t) => {
    if (!HAS_REAL_DSH_RUNTIME) {
      t.skip('Real @deepseek-ai/dsh packages not available');
      return;
    }

    const sandbox = createSandbox();
    fs.writeFileSync(path.join(sandbox.repoDir, 'CLAUDE.md'), 'PARENT_SHARED_BASELINE\n', 'utf8');

    const harness = await bootHarness({ sandbox, locale: 'en' });
    try {
      const parentId = harness.SessionId('sess-parent-v4');
      const parentHandle = await harness.ctx.agents.create({
        sessionId: parentId,
        meta: { cwd: sandbox.repoDir },
      });
      const parent = parentHandle.agent;

      const d1 = await runPreStep(harness, parent, 'parent hello', 1);
      assert.equal(d1.kind, 'enter');
      assert.ok(d1.messages.some((m: any) => m.source?.kind === 'unified-memory'));
      await harness.ctx.sessions.flush(parent.session);

      // 6a. Real subagent_fork with buildForkSeed + isSeeded: true
      const parentEvents = parent.session.snapshotEvents();
      const boundary = harness.SessionSeq(parentEvents.length - 1);
      const seed = harness.buildForkSeed(parentEvents, boundary);
      const forkHandle = await harness.ctx.agents.create({
        sessionId: harness.SessionId('sess-fork-child'),
        meta: {
          cwd: sandbox.repoDir,
          parentSession: parentId,
          isSeeded: true,
          origin: 'subagent',
          delegationDepth: 1,
        },
        inheritedEventCount: parentEvents.length as any,
        seed,
      });

      const forkDecision = await runPreStep(harness, forkHandle.agent, 'subagent task', 1);
      assert.equal(forkDecision.kind, 'enter');
      const duplicateBaseline = forkDecision.messages.find(
        (m: any) => m.source?.kind === 'unified-memory' && m.source?.baseline === true,
      );
      assert.equal(
        duplicateBaseline,
        undefined,
        'Seeded subagent_fork must NOT inject duplicate baseline (preserves KV-cache)',
      );

      // 6b. Real V4 resume from persisted JSONL log on disk
      await parentHandle.dispose();
      const resumedHandle = await harness.ctx.agents.resume({ resumeSessionId: parentId });
      assert.ok(resumedHandle.agent, 'ctx.agents.resume() must accept V4 unified-memory events');
      const resumedDecision = await runPreStep(harness, resumedHandle.agent, 'after resume', 2);
      assert.equal(resumedDecision.kind, 'enter');
      const resumedDup = resumedDecision.messages.find(
        (m: any) => m.source?.kind === 'unified-memory' && m.source?.baseline === true,
      );
      assert.equal(
        resumedDup,
        undefined,
        'Resumed session with visible baseline must NOT duplicate baseline',
      );
    } finally {
      await harness.dispose();
      sandbox.cleanup();
    }
  });

  it('7. /memory slash commands (status, list, rules, trust, reload) in both en and zh', async (t) => {
    if (!HAS_REAL_DSH_RUNTIME) {
      t.skip('Real @deepseek-ai/dsh packages not available');
      return;
    }

    const sandbox = createSandbox();
    fs.writeFileSync(
      path.join(sandbox.repoDir, 'CLAUDE.md'),
      `# Root\n@${sandbox.externalSecretPath}\n`,
      'utf8',
    );

    const harness = await bootHarness({
      sandbox,
      locale: 'auto',
      withSettings: true,
      hostLocalePref: 'en',
    });

    try {
      const handle = await harness.ctx.agents.create({
        sessionId: harness.SessionId('sess-cmd-1'),
        meta: { cwd: sandbox.repoDir },
      });
      const agent = handle.agent;
      await runPreStep(harness, agent, 'init', 1);

      const runMemoryCmd = async (subcommand: string) => {
        const res = await harness.ctx.commands.execute(
          agent,
          `/memory ${subcommand}`.trim(),
          [],
          new AbortController().signal,
        );
        return typeof res === 'string' ? res : JSON.stringify(res);
      };

      // English commands
      for (const sub of ['status', 'list', 'rules', 'trust']) {
        const out = await runMemoryCmd(` ${sub}`);
        assert.ok(out.length > 10, `/memory ${sub} (en) must return non-empty response`);
      }

      // Switch to Chinese and verify localized output (including P1 fix: no English "(from `...`)")
      harness.setHostLocale('zh');
      const statusZh = await runMemoryCmd(' status');
      assert.ok(/[\u4e00-\u9fff]/.test(statusZh), '/memory status in zh must return Chinese text');

      const trustZh = await runMemoryCmd(' trust');
      assert.ok(/[\u4e00-\u9fff]/.test(trustZh), '/memory trust in zh must return Chinese text');
      assert.equal(
        trustZh.includes('(from `'),
        false,
        '/memory trust in zh must not leak untranslated "(from `...`)"',
      );

      // /memory reload forces re-injection on next pre-step
      const reloadOut = await runMemoryCmd(' reload');
      assert.ok(reloadOut.length > 0);
      const afterReload = await runPreStep(harness, agent, 'after reload', 2);
      assert.equal(afterReload.kind, 'enter');
      assert.ok(
        afterReload.messages.some(
          (m: any) => m.source?.kind === 'unified-memory' && m.source?.baseline === true,
        ),
        '/memory reload must force baseline re-injection on next pre-step',
      );
    } finally {
      await harness.dispose();
      sandbox.cleanup();
    }
  });

  it('8. All 16 HTTP routes via real HostConnectionService: Owner 200, Guest 403, PUT/DELETE rejected, external trust flow & autoMemoryEnabled 403', async (t) => {
    if (!HAS_REAL_DSH_RUNTIME) {
      t.skip('Real @deepseek-ai/dsh packages not available');
      return;
    }

    const sandbox = createSandbox();
    fs.writeFileSync(
      path.join(sandbox.repoDir, 'CLAUDE.md'),
      `# Workspace\n@${sandbox.externalSecretPath}\n`,
      'utf8',
    );
    fs.writeFileSync(
      path.join(sandbox.codexHome, 'memories_v2', 'memory_summary.md'),
      '# Codex Summary\nFast release pipeline.\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(sandbox.codexHome, 'memories_v2', 'rollout_summaries', 'r1.md'),
      '# Rollout 1\nRelease checklist verified.\n',
      'utf8',
    );

    const harness = await bootHarness({
      sandbox,
      locale: 'en',
      withConnection: true,
    });

    try {
      const connection = (harness.ctx as any).connection;
      assert.ok(connection, 'HostConnectionService must be active');
      const fetchHandler = connection.createSharedFetchHandler('/api');
      const ownerPeer = connection.browserPeer;
      const guestPeer = connection.createPeer({ principal: { kind: 'guest' } });

      const call = async (
        method: string,
        pathAndQuery: string,
        body?: unknown,
        peer = ownerPeer,
      ): Promise<Response> => {
        const init: RequestInit = { method };
        if (body !== undefined) {
          init.headers = { 'content-type': 'application/json' };
          init.body = JSON.stringify(body);
        }
        return await fetchHandler.fetch(new Request(`http://127.0.0.1${pathAndQuery}`, init), peer);
      };

      // Create an active session so SESSION_CONTEXT returns live data
      const handle = await harness.ctx.agents.create({
        sessionId: harness.SessionId('sess-http-1'),
        meta: { cwd: sandbox.repoDir },
      });
      await runPreStep(harness, handle.agent, 'hello http', 1);

      // Guest peer MUST receive 403 on all protected routes
      for (const [method, url, body] of [
        ['GET', API_PATHS.OVERVIEW, undefined],
        ['POST', API_PATHS.TRUST_UPDATE, { workspacePath: sandbox.repoDir, action: 'allow', targetPath: sandbox.externalSecretPath }],
        ['POST', API_PATHS.CONFIG_UPDATE, { locale: 'zh' }],
        ['POST', API_PATHS.CLAUDE_SAVE, { projectPath: sandbox.repoDir, name: 'x', description: 'y', type: 'project', body: 'z' }],
      ] as const) {
        const res = await call(method, url, body, guestPeer);
        assert.equal(res.status, 403, `Guest peer must get 403 on ${method} ${url}`);
      }

      // PUT / DELETE / PATCH MUST NOT be allowed on any route
      for (const badMethod of ['PUT', 'DELETE', 'PATCH']) {
        const r1 = await call(badMethod, API_PATHS.CONFIG_UPDATE, { locale: 'en' });
        assert.ok(r1.status === 404 || r1.status === 405, `${badMethod} must be rejected`);
        const r2 = await call(badMethod, API_PATHS.CLAUDE_DELETE, { projectPath: sandbox.repoDir, filename: 'a.md' });
        assert.ok(r2.status === 404 || r2.status === 405, `${badMethod} must be rejected`);
      }

      // Exercise ALL 16 routes with Owner peer -> 200
      const qRepo = encodeURIComponent(sandbox.repoDir);

      // 1. OVERVIEW
      const rOverview = await call('GET', `${API_PATHS.OVERVIEW}?cwd=${qRepo}`);
      assert.equal(rOverview.status, 200);
      const overview = await rOverview.json();
      assert.equal(overview.codex.activeGeneration, 'v2');

      // 2. CLAUDE_RESOLVE
      const rResolve = await call('GET', `${API_PATHS.CLAUDE_RESOLVE}?path=${qRepo}`);
      assert.equal(rResolve.status, 200);
      const resolved = await rResolve.json();
      assert.ok(resolved.slug);

      // 3. CLAUDE_SAVE
      const rSave = await call('POST', API_PATHS.CLAUDE_SAVE, {
        projectPath: sandbox.repoDir,
        name: 'API Contract Note',
        description: 'Testing all 16 routes',
        type: 'project',
        body: 'Saved via HTTP API.',
      });
      assert.equal(rSave.status, 200);
      const saved = await rSave.json();
      assert.ok(saved.topic?.filename);

      // 4. CLAUDE_LIST
      const rList = await call('GET', `${API_PATHS.CLAUDE_LIST}?projectPath=${qRepo}`);
      assert.equal(rList.status, 200);
      assert.equal((await rList.json()).topics.length, 1);

      // 5. CLAUDE_READ
      const rRead = await call(
        'GET',
        `${API_PATHS.CLAUDE_READ}?projectPath=${qRepo}&filename=${encodeURIComponent(saved.topic.filename)}`,
      );
      assert.equal(rRead.status, 200);
      assert.equal((await rRead.json()).kind, 'topic');

      // 6. CLAUDE_SAVE_INDEX
      const rSaveIdx = await call('POST', API_PATHS.CLAUDE_SAVE_INDEX, {
        projectPath: sandbox.repoDir,
        content: `# Memory Index\n- [${saved.topic.filename}](./${saved.topic.filename}) — API Contract Note\n`,
      });
      assert.equal(rSaveIdx.status, 200);

      // 7. CLAUDE_DELETE
      const rDelete = await call('POST', API_PATHS.CLAUDE_DELETE, {
        projectPath: sandbox.repoDir,
        filename: saved.topic.filename,
      });
      assert.equal(rDelete.status, 200);
      assert.equal((await rDelete.json()).deleted, true);

      // 8. CODEX_SUMMARY
      const rCodexSum = await call('GET', `${API_PATHS.CODEX_SUMMARY}?generation=v2`);
      assert.equal(rCodexSum.status, 200);
      assert.equal((await rCodexSum.json()).readOnly, true);

      // 9. CODEX_BROWSE
      const rCodexBrowse = await call('GET', `${API_PATHS.CODEX_BROWSE}?generation=v2`);
      assert.equal(rCodexBrowse.status, 200);
      assert.ok((await rCodexBrowse.json()).files.length >= 1);

      // 10. CODEX_SEARCH (POST)
      const rCodexSearch = await call('POST', API_PATHS.CODEX_SEARCH, {
        query: 'Release',
        generation: 'v2',
      });
      assert.equal(rCodexSearch.status, 200);
      assert.ok((await rCodexSearch.json()).hits.length >= 1);

      // 11. CODEX_READ
      const rCodexRead = await call(
        'GET',
        `${API_PATHS.CODEX_READ}?generation=v2&relativePath=${encodeURIComponent('rollout_summaries/r1.md')}`,
      );
      assert.equal(rCodexRead.status, 200);
      assert.ok((await rCodexRead.json()).content.includes('Release checklist'));

      // 12. RULES_INSPECT -> pending external import before trust update
      const rRulesBefore = await call('GET', `${API_PATHS.RULES_INSPECT}?workspacePath=${qRepo}`);
      assert.equal(rRulesBefore.status, 200);
      const rulesBefore = await rRulesBefore.json();
      assert.ok(
        rulesBefore.workspace?.blockedExternalTargets?.some(
          (f: any) =>
            f.status === 'pending_approval' && f.resolvedTarget === sandbox.externalSecretPath,
        ),
      );

      // 13. TRUST_UPDATE (allow -> approved, then deny -> denied)
      const rTrustAllow = await call('POST', API_PATHS.TRUST_UPDATE, {
        workspacePath: sandbox.repoDir,
        action: 'allow',
        targetPath: sandbox.externalSecretPath,
      });
      assert.equal(rTrustAllow.status, 200);
      const rRulesAfter = await call('GET', `${API_PATHS.RULES_INSPECT}?workspacePath=${qRepo}`);
      const rulesAfter = await rRulesAfter.json();
      assert.ok(
        rulesAfter.workspace?.approvedExternalTargets?.some(
          (f: any) => f.resolvedTarget === sandbox.externalSecretPath,
        ),
      );

      const rTrustDeny = await call('POST', API_PATHS.TRUST_UPDATE, {
        workspacePath: sandbox.repoDir,
        action: 'deny',
        targetPath: sandbox.externalSecretPath,
      });
      assert.equal(rTrustDeny.status, 200);

      // 14. CONFIG_UPDATE
      const rCfg = await call('POST', API_PATHS.CONFIG_UPDATE, { locale: 'zh' });
      assert.equal(rCfg.status, 200);
      assert.equal((await rCfg.json()).config.locale, 'zh');

      // 15. SESSION_CONTEXT
      const rSessCtx = await call('GET', `${API_PATHS.SESSION_CONTEXT}?sessionId=sess-http-1`);
      assert.equal(rSessCtx.status, 200);
      const sessCtx = await rSessCtx.json();
      assert.equal(sessCtx.session?.sessionId, 'sess-http-1');
      assert.equal(sessCtx.session?.baselineInjected, true);

      // 16. DIAGNOSTICS_CLEAR
      const rDiagClear = await call('POST', API_PATHS.DIAGNOSTICS_CLEAR, {});
      assert.equal(rDiagClear.status, 200);
      assert.equal((await rDiagClear.json()).cleared, true);

      // P1 Regression: CLAUDE_SAVE and CLAUDE_SAVE_INDEX return 403 when CLAUDE_CODE_DISABLE_AUTO_MEMORY=1
      process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY = '1';
      const rSaveBlocked = await call('POST', API_PATHS.CLAUDE_SAVE, {
        slug: resolved.slug,
        name: 'Should Block',
        description: 'Disabled',
        type: 'project',
        body: 'No write',
      });
      assert.equal(rSaveBlocked.status, 403);
      assert.equal((await rSaveBlocked.json()).code, 'AUTO_MEMORY_DISABLED');

      const rIdxBlocked = await call('POST', API_PATHS.CLAUDE_SAVE_INDEX, {
        slug: resolved.slug,
        content: '# Blocked',
      });
      assert.equal(rIdxBlocked.status, 403);
      assert.equal((await rIdxBlocked.json()).code, 'AUTO_MEMORY_DISABLED');
    } finally {
      await harness.dispose();
      sandbox.cleanup();
    }
  });

  it('9. Minimal headless profile boot without optional connection/settings/commands/skills (and SDK stub boot without systemPrompt)', async (t) => {
    if (!HAS_REAL_DSH_RUNTIME) {
      t.skip('Real @deepseek-ai/dsh packages not available');
      return;
    }

    const sandbox = createSandbox();
    fs.writeFileSync(path.join(sandbox.repoDir, 'CLAUDE.md'), 'HEADLESS_RULE_OK\n', 'utf8');

    // 9a. Real DSH headless profile (no connection, settings, commands, skills)
    const harness = await bootHarness({
      sandbox,
      locale: 'en',
      headlessMinimal: true,
      withAgentInstructions: false,
      withConnection: false,
      withSettings: false,
    });

    try {
      assert.equal(harness.umFiber.state, 2, 'Headless minimal boot must be ACTIVE');
      assert.equal((harness.ctx as any).connection, undefined);
      assert.equal((harness.ctx as any).settings, undefined);
      assert.equal((harness.ctx as any).commands, undefined);
      assert.equal((harness.ctx as any).skills, undefined);

      assert.equal(harness.ctx.tools.definitions().length, 9);

      const handle = await harness.ctx.agents.create({
        sessionId: harness.SessionId('sess-headless-1'),
        meta: { cwd: sandbox.repoDir },
      });
      const d = await runPreStep(harness, handle.agent, 'headless ping', 1);
      assert.equal(d.kind, 'enter');
      assert.ok(d.messages.some((m) => textOfMessage(m).includes('HEADLESS_RULE_OK')));

      // 9b. Pure minimal SDK context with NO systemPrompt, connection, settings, commands, skills
      const { Context: CordisContext, Service } = await importDsh('@deepseek-ai/cordis');
      const UnifiedMemoryPlugin = await import(pathToFileURL(HOST_BUNDLE_PATH).href);
      const sdkCtx = new CordisContext() as Context;
      const registeredTools: string[] = [];
      class StubAgents extends Service {
        constructor(c: Context) {
          super(c, 'agents');
        }
        list() {
          return [];
        }
      }
      class StubTools extends Service {
        constructor(c: Context) {
          super(c, 'tools');
        }
        register(def: { name: string }) {
          registeredTools.push(def.name);
          return () => {};
        }
      }
      class StubWd extends Service {
        constructor(c: Context) {
          super(c, 'workingDirectory');
        }
        current() {
          return sandbox.repoDir;
        }
      }
      sdkCtx.plugin(StubAgents);
      sdkCtx.plugin(StubTools);
      sdkCtx.plugin(StubWd);
      const sdkFiber = sdkCtx.plugin(UnifiedMemoryPlugin, {
        locale: 'en',
        dataDir: sandbox.dataDir,
      });
      await new Promise((r) => setTimeout(r, 80));
      assert.equal(sdkFiber.state, 2, 'SDK boot without systemPrompt must still be ACTIVE');
      assert.equal((sdkCtx as any).systemPrompt, undefined);
      assert.equal(registeredTools.length, 9);
      await sdkCtx.fiber.dispose();
    } finally {
      await harness.dispose();
      sandbox.cleanup();
    }
  });
});
