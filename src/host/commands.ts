import type { Context } from '@deepseek-ai/cordis';
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands';
import {
  DEFAULT_HOST_NAME,
  DEFAULT_NATIVE_RULE_FILENAMES,
  getCodexMemoryStatus,
  getMessages,
  getWorkspaceExternalTrust,
  listTopicMemories,
  loadClaudeRulesForWorkspaces,
  readMemoryIndex,
  resolveClaudeProject,
  updateWorkspaceExternalTrust,
} from '../core/index.js';
import type { HostRuntime } from './runtime.js';

function tokenizeCommandInput(raw: string): string[] {
  const tokens: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur.length > 0) {
        tokens.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (cur.length > 0) tokens.push(cur);
  return tokens;
}

async function handleMemoryCommand(
  runtime: HostRuntime,
  invocation: CommandInvocation,
): Promise<CommandResult> {
  const tokens = tokenizeCommandInput(invocation.rawInput.trim());
  const sub = (tokens[0] ?? 'status').toLowerCase();
  const cfg = runtime.getEffectiveConfig();
  const locale = runtime.resolveEffectiveLocale();
  const msg = getMessages(locale);
  const isZh = locale === 'zh';

  const cwd = await runtime.resolveAgentCwd(invocation.agent, invocation.signal);
  if (!cwd) {
    return {
      kind: 'error',
      text: isZh ? '无法解析当前会话的工作目录。' : 'Unable to resolve current session working directory.',
    };
  }

  const sid = String(invocation.agent.id);
  const liveSnap = runtime.liveSessions.get(sid);

  if (sub === 'status') {
    const res = resolveClaudeProject(cwd, {
      claudeConfigDir: runtime.claudeConfigDir,
      env: runtime.env,
    });
    const idx = readMemoryIndex(res.memoryDir);
    const topics = listTopicMemories(res.memoryDir);
    const codex = getCodexMemoryStatus(runtime.codexHome);
    const lines = [
      `## ${msg.cmdTitle}`,
      `- ${msg.cmdStatusLineLocale(locale, cfg.locale)}`,
      `- ${msg.cmdStatusLineWorkspace(cwd, res.resolvedRoot, res.isGitWorktree)}`,
      `- ${msg.cmdStatusLineClaude(res.slug, res.memoryDir, res.autoMemoryEnabled, res.exists)}`,
      `- ${msg.cmdStatusLineIndex(idx.totalLines, idx.maxLines, (idx.totalBytes / 1024).toFixed(1), idx.truncated)}`,
      `- ${msg.cmdStatusLineTopics(topics.length)}`,
      `- ${msg.cmdStatusLineCodex(codex.activeGeneration, codex.codexHome)}`,
      `- ${msg.cmdStatusLineSession(
        liveSnap?.baselineInjected ?? false,
        liveSnap?.compactionCount ?? 0,
        liveSnap?.hostLoadedPaths.length ?? 0,
        liveSnap?.indexedConditionalRules.filter((r) => r.loaded).length ?? 0,
      )}`,
    ];
    return { kind: 'success', text: lines.join('\n') };
  }

  if (sub === 'list') {
    const res = resolveClaudeProject(cwd, {
      claudeConfigDir: runtime.claudeConfigDir,
      env: runtime.env,
    });
    const topics = listTopicMemories(res.memoryDir);
    if (topics.length === 0) {
      return { kind: 'success', text: msg.cmdNoTopics };
    }
    const header = isZh
      ? `## Claude 自动记忆列表（${topics.length} 条，slug=${res.slug}）`
      : `## Claude Auto Memory Topics (${topics.length}, slug=${res.slug})`;
    const items = topics.map(
      (t) => `- **${t.name}** [\`${t.type}\`] (\`${t.filename}\`): ${t.description}`,
    );
    return { kind: 'success', text: [header, ...items].join('\n') };
  }

  if (sub === 'rules') {
    const hostSet = new Set(liveSnap?.hostLoadedPaths ?? []);
    const loaded = loadClaudeRulesForWorkspaces([cwd], {
      claudeConfigDir: runtime.claudeConfigDir,
      homeDir: runtime.homeDir,
      deduplicateNativeAgentsMd: cfg.deduplicateNativeAgentsMd,
      nativeRuleFilenames: DEFAULT_NATIVE_RULE_FILENAMES,
      hostName: DEFAULT_HOST_NAME,
      alreadyLoadedPaths: hostSet,
      trustClaudeCodeExternalApprovals: cfg.trustClaudeCodeExternalApprovals,
      externalRuleTrust: cfg.externalRuleTrust,
    });
    const ws = loaded.workspaces[0];
    const lines: string[] = [
      isZh ? `## 已加载规则检查（${cwd}）` : `## Loaded Rules Inspection (${cwd})`,
    ];
    const formatRule = (r: (typeof loaded.globalAlwaysOn)[number]): string => {
      const badges: string[] = [r.scope];
      if (r.dedupedByHost) badges.push(isZh ? '宿主已加载(去重)' : 'host-deduped');
      if (r.imports.length > 0) badges.push(`@imports:${r.imports.length}`);
      if (r.paths && r.paths.length > 0) badges.push(`paths:${r.paths.join(',')}`);
      return `- \`${r.displayPath}\` [${badges.join(' | ')}]`;
    };

    const alwaysOn = [...loaded.globalAlwaysOn, ...(ws?.alwaysOn ?? [])];
    const conditional = [...loaded.globalConditional, ...(ws?.conditional ?? [])];

    lines.push(
      isZh
        ? `\n### 常驻规则 (${alwaysOn.length})`
        : `\n### Always-On Rules (${alwaysOn.length})`,
    );
    lines.push(
      ...(alwaysOn.length > 0
        ? alwaysOn.map(formatRule)
        : [isZh ? '- （无）' : '- (none)']),
    );

    lines.push(
      isZh
        ? `\n### 条件规则 paths: (${conditional.length})`
        : `\n### Conditional paths: Rules (${conditional.length})`,
    );
    lines.push(
      ...(conditional.length > 0
        ? conditional.map(formatRule)
        : [isZh ? '- （无）' : '- (none)']),
    );

    const pendingCount =
      ws?.blockedExternalTargets.filter((b) => b.status === 'pending_approval').length ?? 0;
    if (pendingCount > 0) {
      lines.push(`\n${msg.pendingExternalRuleNotice(pendingCount)}`);
    }
    return { kind: 'success', text: lines.join('\n') };
  }

  if (sub === 'trust') {
    const action = (tokens[1] ?? 'list').toLowerCase();
    if (action === 'allow' || action === 'deny' || action === 'revoke') {
      const targetPath = tokens.slice(2).join(' ').trim();
      if (!targetPath) {
        return {
          kind: 'error',
          text: isZh
            ? `用法：/memory trust ${action} <绝对路径>`
            : `Usage: /memory trust ${action} <target-path>`,
        };
      }
      const updated = updateWorkspaceExternalTrust(cwd, action, targetPath, runtime.dataDir);
      return {
        kind: 'success',
        text: isZh
          ? `已更新工作区外部信任规则（action=${action}，target=${targetPath}）。当前允许 ${updated.trust.allowPaths.length} 项、拒绝 ${updated.trust.denyPaths.length} 项。`
          : `Updated external trust (action=${action}, target=${targetPath}). Active allowlist: ${updated.trust.allowPaths.length}, denylist: ${updated.trust.denyPaths.length}.`,
      };
    }
    if (action === 'clear') {
      updateWorkspaceExternalTrust(cwd, 'clear_workspace', undefined, runtime.dataDir);
      return {
        kind: 'success',
        text: isZh
          ? `已清空工作区 ${cwd} 的全部外部信任覆盖规则。`
          : `Cleared all external trust overrides for workspace ${cwd}.`,
      };
    }

    const loaded = loadClaudeRulesForWorkspaces([cwd], {
      claudeConfigDir: runtime.claudeConfigDir,
      homeDir: runtime.homeDir,
      deduplicateNativeAgentsMd: cfg.deduplicateNativeAgentsMd,
      nativeRuleFilenames: DEFAULT_NATIVE_RULE_FILENAMES,
      hostName: DEFAULT_HOST_NAME,
      trustClaudeCodeExternalApprovals: cfg.trustClaudeCodeExternalApprovals,
      externalRuleTrust: cfg.externalRuleTrust,
    });
    const ws = loaded.workspaces[0];
    const trust = getWorkspaceExternalTrust(cfg.externalRuleTrust, cwd);
    const blocked = ws?.blockedExternalTargets ?? [];
    if (blocked.length === 0 && trust.allowPaths.length === 0 && trust.denyPaths.length === 0) {
      return { kind: 'success', text: msg.cmdNoExternalPending };
    }
    const lines: string[] = [
      isZh ? `## 外部规则信任边界（${cwd}）` : `## External Rule Trust (${cwd})`,
      isZh
        ? `- 允许列表 (${trust.allowPaths.length}): ${trust.allowPaths.join(', ') || '（无）'}`
        : `- Allowlist (${trust.allowPaths.length}): ${trust.allowPaths.join(', ') || '(none)'}`,
      isZh
        ? `- 拒绝列表 (${trust.denyPaths.length}): ${trust.denyPaths.join(', ') || '（无）'}`
        : `- Denylist (${trust.denyPaths.length}): ${trust.denyPaths.join(', ') || '(none)'}`,
    ];
    if (blocked.length > 0) {
      lines.push(isZh ? '\n### 已拦截的外部目标' : '\n### Blocked External Targets');
      for (const b of blocked) {
        lines.push(
          isZh
            ? `- [${b.status}] \`${b.resolvedTarget}\`（来源：\`${b.sourceDisplayPath}\`）`
            : `- [${b.status}] \`${b.resolvedTarget}\` (from \`${b.sourceDisplayPath}\`)`,
        );
      }
      lines.push(
        isZh
          ? '\n可执行 `/memory trust allow <路径>` 或 `/memory trust deny <路径>` 进行管理。'
          : '\nRun `/memory trust allow <path>` or `/memory trust deny <path>` to update.',
      );
    }
    return { kind: 'success', text: lines.join('\n') };
  }

  if (sub === 'reload') {
    runtime.pendingReloadSessions.add(sid);
    return { kind: 'success', text: msg.cmdReloadNotice };
  }

  return { kind: 'error', text: msg.cmdUsageHint };
}

export function registerSlashCommands(ctx: Context, runtime: HostRuntime): void {
  ctx.inject(['commands'], (c) => {
    c.effect(() =>
      c.commands.register({
        name: 'memory',
        description:
          'Inspect or manage Unified Memory (status | list | rules | trust | reload) | 查看或管理统一记忆与规则',
        input: { hint: '[status | list | rules | trust | reload]' },
        handler: (invocation) => handleMemoryCommand(runtime, invocation),
      }),
    );
  });
}
