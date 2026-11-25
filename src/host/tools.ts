import path from 'node:path';
import type { Context } from '@deepseek-ai/cordis';
import { defineTool } from '@deepseek-ai/dsh-tools';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import {
  DEFAULT_HOST_NAME,
  DEFAULT_NATIVE_RULE_FILENAMES,
  deleteTopicMemory,
  getCodexMemoryStatus,
  getMessages,
  listTopicMemories,
  loadClaudeRulesForWorkspaces,
  readCodexMemoryFile,
  readCodexSummary,
  readMemoryIndex,
  readTopicMemory,
  resolveClaudeProject,
  saveTopicMemory,
  searchCodexMemories,
  type ClaudeMemoryType,
} from '../core/index.js';
import type { HostRuntime } from './runtime.js';

async function resolveWorkspaceArg(
  explicitPath: string | undefined,
  exec: ToolRunContext,
  runtime: HostRuntime,
): Promise<string> {
  if (explicitPath && explicitPath.trim().length > 0) {
    return path.resolve(explicitPath.trim());
  }
  const cwd = await runtime.resolveAgentCwd(exec.agent, exec.signal);
  if (cwd) return cwd;
  throw new Error('Unable to resolve workspace path; pass projectPath/workspacePath explicitly.');
}

function renderJsonText(_args: unknown, value: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
}

/**
 * Strips `undefined` properties and normalizes TypeScript interfaces into strict
 * lossless JSON objects accepted by `@deepseek-ai/dsh-tools`'s `JsonValue` schema.
 */
function toJsonObject(value: unknown): Record<string, never> {
  return JSON.parse(JSON.stringify(value)) as Record<string, never>;
}

export function registerHostTools(ctx: Context, runtime: HostRuntime): void {
  const register = (tool: ReturnType<typeof defineTool>) => {
    ctx.effect(() => ctx.tools.register(tool));
  };

  // 1. claude_memory_status
  register(
    defineTool({
      name: 'claude_memory_status',
      description:
        'Resolve the active workspace (or an explicit projectPath) to its canonical Claude Code Auto Memory directory (Git worktree, autoMemoryDirectory, slug encoding) and report MEMORY.md budget usage. | 解析当前工作区的 Claude 自动记忆目录与 MEMORY.md 容量使用情况。',
      parameters: {
        projectPath: {
          type: 'string',
          description: 'Optional workspace/project path. Defaults to the current session working directory.',
        },
      },
      output: {
        schema: { type: 'json' },
        render: renderJsonText,
      },
      isConcurrencySafe: () => true,
      presentCall: (args) => ({
        card: 'generic',
        kind: 'read',
        title: args.projectPath
          ? `Claude memory status (${path.basename(args.projectPath)})`
          : 'Claude memory status',
      }),
      async execute(args, exec) {
        const ws = await resolveWorkspaceArg(args.projectPath, exec, runtime);
        const resolution = resolveClaudeProject(ws, {
          claudeConfigDir: runtime.claudeConfigDir,
          env: runtime.env,
        });
        const index = readMemoryIndex(resolution.memoryDir);
        const topics = listTopicMemories(resolution.memoryDir);
        const byType: Record<string, number> = {};
        for (const t of topics) {
          byType[t.type] = (byType[t.type] ?? 0) + 1;
        }
        return toJsonObject({
          resolution,
          index: {
            exists: index.exists,
            filePath: index.filePath,
            totalLines: index.totalLines,
            maxLines: index.maxLines,
            totalBytes: index.totalBytes,
            maxBytes: index.maxBytes,
            truncated: index.truncated,
          },
          topicCount: topics.length,
          topicsByType: byType,
        });
      },
    }),
  );

  // 2. claude_memory_list
  register(
    defineTool({
      name: 'claude_memory_list',
      description:
        'List all Claude Code Auto Memory topic files and MEMORY.md index summary for the active project (or projectPath). | 列出当前项目的 Claude 自动记忆主题文件与 MEMORY.md 摘要。',
      parameters: {
        projectPath: {
          type: 'string',
          description: 'Optional workspace/project path. Defaults to the current session working directory.',
        },
        type: {
          type: 'string',
          enum: ['user', 'feedback', 'project', 'reference'] as const,
          description: 'Optional filter by Claude Code memory category.',
        },
      },
      output: {
        schema: { type: 'json' },
        render: renderJsonText,
      },
      isConcurrencySafe: () => true,
      presentCall: (args) => ({
        card: 'generic',
        kind: 'read',
        title: args.type ? `List Claude memories (${args.type})` : 'List Claude memories',
      }),
      async execute(args, exec) {
        const ws = await resolveWorkspaceArg(args.projectPath, exec, runtime);
        const resolution = resolveClaudeProject(ws, {
          claudeConfigDir: runtime.claudeConfigDir,
          env: runtime.env,
        });
        const index = readMemoryIndex(resolution.memoryDir);
        let topics = listTopicMemories(resolution.memoryDir);
        if (args.type) {
          topics = topics.filter((t) => t.type === args.type);
        }
        return {
          slug: resolution.slug,
          memoryDir: resolution.memoryDir,
          autoMemoryEnabled: resolution.autoMemoryEnabled,
          index: {
            exists: index.exists,
            totalLines: index.totalLines,
            totalBytes: index.totalBytes,
            truncated: index.truncated,
            preview: index.truncatedContent,
          },
          topics: topics.map((t) => ({
            filename: t.filename,
            name: t.name,
            description: t.description,
            type: t.type,
            schema: t.schema,
            modified: t.modified ?? null,
            sizeBytes: t.sizeBytes,
          })),
        };
      },
    }),
  );

  // 3. claude_memory_read
  register(
    defineTool({
      name: 'claude_memory_read',
      description:
        'Read MEMORY.md (when filename is omitted) or a specific Claude Code topic memory markdown file. | 读取 MEMORY.md 索引或指定的 Claude 主题记忆文件。',
      parameters: {
        projectPath: {
          type: 'string',
          description: 'Optional workspace/project path. Defaults to the current session working directory.',
        },
        filename: {
          type: 'string',
          description: 'Topic filename (e.g. "feedback_testing.md"). Omit to read MEMORY.md.',
        },
      },
      output: {
        schema: { type: 'json' },
        render: renderJsonText,
      },
      isConcurrencySafe: () => true,
      presentCall: (args) => ({
        card: 'generic',
        kind: 'read',
        title: `Read memory ${args.filename?.trim() || 'MEMORY.md'}`,
      }),
      async execute(args, exec) {
        const ws = await resolveWorkspaceArg(args.projectPath, exec, runtime);
        const resolution = resolveClaudeProject(ws, {
          claudeConfigDir: runtime.claudeConfigDir,
          env: runtime.env,
        });
        const trimmed = args.filename?.trim() ?? '';
        if (!trimmed || trimmed === 'MEMORY.md') {
          return toJsonObject(readMemoryIndex(resolution.memoryDir));
        }
        const topic = readTopicMemory(resolution.memoryDir, trimmed);
        if (!topic) {
          const msg = getMessages(runtime.resolveEffectiveLocale());
          throw new Error(msg.topicNotFoundError(trimmed, resolution.memoryDir));
        }
        return toJsonObject(topic);
      },
    }),
  );

  // 4. claude_memory_save
  register(
    defineTool({
      name: 'claude_memory_save',
      description:
        'Create or update a Claude Code Auto Memory topic file using the v2.1.x nested metadata schema (node_type: memory), with cross-process locking, atomic writes, and automatic MEMORY.md sync. | 创建或更新 Claude 自动记忆主题文件（兼容 v2.1.x 格式与跨进程文件锁），并自动同步 MEMORY.md 索引。',
      parameters: {
        projectPath: {
          type: 'string',
          description: 'Optional workspace/project path. Defaults to the current session working directory.',
        },
        name: {
          type: 'string',
          required: true,
          description: 'Short title or slug for this memory topic (Chinese or English supported).',
        },
        description: {
          type: 'string',
          required: true,
          description: 'Concise one-line description used for relevance recall and MEMORY.md index.',
        },
        type: {
          type: 'string',
          enum: ['user', 'feedback', 'project', 'reference'] as const,
          required: true,
          description: 'Claude Code memory category: user | feedback | project | reference.',
        },
        body: {
          type: 'string',
          required: true,
          description: 'Markdown body content of the memory note.',
        },
        filename: {
          type: 'string',
          description: 'Optional explicit filename (e.g. "feedback_db_tests.md"). Derived from name if omitted.',
        },
        originSessionId: {
          type: 'string',
          description: 'Optional session ID recorded in metadata.originSessionId (auto-filled from current session).',
        },
      },
      output: {
        schema: { type: 'json' },
        render: renderJsonText,
      },
      presentCall: (args) => ({
        card: 'generic',
        kind: 'edit',
        title: `Save Claude memory: ${args.name} (${args.type})`,
      }),
      async execute(args, exec) {
        const ws = await resolveWorkspaceArg(args.projectPath, exec, runtime);
        const locale = runtime.resolveEffectiveLocale();
        const msg = getMessages(locale);
        const resolution = resolveClaudeProject(ws, {
          claudeConfigDir: runtime.claudeConfigDir,
          env: runtime.env,
        });
        if (!resolution.autoMemoryEnabled) {
          throw new Error(msg.autoMemoryDisabledError);
        }
        const originSessionId =
          args.originSessionId?.trim() || (exec.agent ? String(exec.agent.id) : undefined);
        const result = saveTopicMemory(resolution.memoryDir, {
          filename: args.filename,
          name: args.name,
          description: args.description,
          type: args.type as ClaudeMemoryType,
          body: args.body,
          originSessionId,
          locale,
        });
        return {
          saved: true,
          slug: resolution.slug,
          filePath: result.topic.filePath,
          filename: result.topic.filename,
          schema: result.topic.schema,
          modified: result.topic.modified ?? null,
          indexLines: result.index.totalLines,
          indexBytes: result.index.totalBytes,
          warnings: result.warnings,
        };
      },
    }),
  );

  // 5. claude_memory_delete
  register(
    defineTool({
      name: 'claude_memory_delete',
      description:
        'Delete a Claude Code topic memory file and atomically remove its pointer line from MEMORY.md. | 删除指定 Claude 主题记忆文件并原子移除 MEMORY.md 中的索引条目。',
      parameters: {
        projectPath: {
          type: 'string',
          description: 'Optional workspace/project path. Defaults to the current session working directory.',
        },
        filename: {
          type: 'string',
          required: true,
          description: 'Filename of the topic markdown file to delete.',
        },
      },
      output: {
        schema: { type: 'json' },
        render: renderJsonText,
      },
      presentCall: (args) => ({
        card: 'generic',
        kind: 'delete',
        title: `Delete Claude memory: ${args.filename}`,
      }),
      async execute(args, exec) {
        const ws = await resolveWorkspaceArg(args.projectPath, exec, runtime);
        const resolution = resolveClaudeProject(ws, {
          claudeConfigDir: runtime.claudeConfigDir,
          env: runtime.env,
        });
        const res = deleteTopicMemory(resolution.memoryDir, args.filename);
        return {
          deleted: res.deleted,
          filename: args.filename,
          memoryDir: resolution.memoryDir,
          remainingIndexLines: res.index.totalLines,
        };
      },
    }),
  );

  // 6. claude_rules_inspect
  register(
    defineTool({
      name: 'claude_rules_inspect',
      description:
        'Inspect all CLAUDE.md hierarchy files (with @import chains, external trust status, and host dsh-agent-instructions deduplication) and .claude/rules/ files (always-on vs paths-scoped). | 检查工作区全部 CLAUDE.md 层级、@import 展开、宿主去重状态、外部信任拦截与 .claude/rules/ 条件规则。',
      parameters: {
        workspacePath: {
          type: 'string',
          description: 'Optional workspace directory. Defaults to the current session working directory.',
        },
      },
      output: {
        schema: { type: 'json' },
        render: renderJsonText,
      },
      isConcurrencySafe: () => true,
      presentCall: (args) => ({
        card: 'generic',
        kind: 'read',
        title: args.workspacePath
          ? `Inspect Claude rules (${path.basename(args.workspacePath)})`
          : 'Inspect Claude rules',
      }),
      async execute(args, exec) {
        const ws = await resolveWorkspaceArg(args.workspacePath, exec, runtime);
        const cfg = runtime.getEffectiveConfig();
        const locale = runtime.resolveEffectiveLocale();
        const msg = getMessages(locale);
        const liveSnap = exec.agent ? runtime.liveSessions.get(String(exec.agent.id)) : undefined;
        const hostLoadedSet = new Set(liveSnap?.hostLoadedPaths ?? []);

        const loaded = loadClaudeRulesForWorkspaces([ws], {
          claudeConfigDir: runtime.claudeConfigDir,
          homeDir: runtime.homeDir,
          deduplicateNativeAgentsMd: cfg.deduplicateNativeAgentsMd,
          nativeRuleFilenames: DEFAULT_NATIVE_RULE_FILENAMES,
          hostName: DEFAULT_HOST_NAME,
          alreadyLoadedPaths: hostLoadedSet,
          trustClaudeCodeExternalApprovals: cfg.trustClaudeCodeExternalApprovals,
          externalRuleTrust: cfg.externalRuleTrust,
        });

        const wsBundle = loaded.workspaces[0];
        const summarize = (r: (typeof loaded.globalAlwaysOn)[number]) => ({
          displayPath: r.displayPath,
          filePath: r.filePath,
          scope: r.scope,
          isConditional: r.isConditional,
          paths: r.paths,
          dedupedByHost: r.dedupedByHost,
          imports: r.imports,
          skippedDuplicateAgentsMd: r.skippedDuplicateAgentsMd,
          blockedExternalCount: r.blockedExternalTargets.length,
          approvedExternalCount: r.approvedExternalTargets.length,
          sizeBytes: r.sizeBytes,
        });

        const blockedExternalCount = wsBundle ? wsBundle.blockedExternalTargets.length : 0;
        const pendingExternalApprovalCount = wsBundle
          ? wsBundle.blockedExternalTargets.filter((b) => b.status === 'pending_approval').length
          : 0;

        return {
          workspacePath: ws,
          hostLoadedPaths: Array.from(hostLoadedSet),
          globalAlwaysOn: loaded.globalAlwaysOn.map(summarize),
          globalConditional: loaded.globalConditional.map(summarize),
          projectAlwaysOn: wsBundle ? wsBundle.alwaysOn.map(summarize) : [],
          projectConditional: wsBundle ? wsBundle.conditional.map(summarize) : [],
          excludedPaths: wsBundle ? wsBundle.excludedPaths : [],
          externalTrustSummary: {
            trustClaudeCodeExternalApprovals: cfg.trustClaudeCodeExternalApprovals,
            claudeCodeExternalApproved: wsBundle?.claudeCodeExternalApproval?.approved ?? null,
            approvedExternalCount: wsBundle ? wsBundle.approvedExternalTargets.length : 0,
            blockedExternalCount,
            pendingExternalApprovalCount,
            ...(pendingExternalApprovalCount > 0
              ? { note: msg.externalTargetsApprovalNote }
              : {}),
          },
        };
      },
    }),
  );

  // 7. codex_memory_summary
  register(
    defineTool({
      name: 'codex_memory_summary',
      description:
        'Read-only overview of OpenAI Codex CLI local memories (~/.codex/memories_v2 preferred, fallback ~/.codex/memories) and memory_summary.md. | 只读查看 OpenAI Codex 本地记忆状态与 memory_summary.md 摘要。',
      parameters: {
        generation: {
          type: 'string',
          enum: ['auto', 'v2', 'v1'] as const,
          description: 'Codex memory generation to inspect (default: auto).',
        },
        maxBytes: {
          type: 'integer',
          description: 'Maximum bytes of memory_summary.md to return (512..65536, default 12288).',
        },
      },
      output: {
        schema: { type: 'json' },
        render: renderJsonText,
      },
      isConcurrencySafe: () => true,
      presentCall: (args) => ({
        card: 'generic',
        kind: 'read',
        title: `Codex memory summary (${args.generation ?? 'auto'}, read-only)`,
      }),
      async execute(args) {
        const boundedMax =
          typeof args.maxBytes === 'number'
            ? Math.max(512, Math.min(65536, args.maxBytes))
            : 12 * 1024;
        const status = getCodexMemoryStatus(runtime.codexHome);
        const summary = readCodexSummary({
          codexHome: runtime.codexHome,
          generation: args.generation ?? 'auto',
          maxBytes: boundedMax,
        });
        return toJsonObject({ readOnly: true, status, summary });
      },
    }),
  );

  // 8. codex_memory_search
  register(
    defineTool({
      name: 'codex_memory_search',
      description:
        'Search across read-only Codex memories (memory_summary.md, rollout_summaries, extensions/ad_hoc, skills, v1 MEMORY.md handbook), supporting Chinese & English queries. | 跨代次检索只读 Codex 记忆（支持中英文与项目名加权）。',
      parameters: {
        query: {
          type: 'string',
          required: true,
          description: 'Keywords or topic to search for (English or Chinese).',
        },
        projectHint: {
          type: 'string',
          description: 'Optional repo/project name to boost relevant cross-repo results.',
        },
        generation: {
          type: 'string',
          enum: ['auto', 'v2', 'v1', 'both'] as const,
          description: 'Generation scope to search (default: auto).',
        },
        limit: {
          type: 'integer',
          description: 'Maximum hits to return (1..30, default 10).',
        },
      },
      output: {
        schema: { type: 'json' },
        render: renderJsonText,
      },
      isConcurrencySafe: () => true,
      presentCall: (args) => ({
        card: 'generic',
        kind: 'search',
        title: `Search Codex memory: ${args.query}`,
      }),
      async execute(args) {
        const limit =
          typeof args.limit === 'number' ? Math.max(1, Math.min(30, args.limit)) : 10;
        const hits = searchCodexMemories(args.query, {
          codexHome: runtime.codexHome,
          projectHint: args.projectHint,
          generation: args.generation ?? 'auto',
          limit,
        });
        return toJsonObject({
          readOnly: true,
          query: args.query,
          projectHint: args.projectHint ?? null,
          hits,
        });
      },
    }),
  );

  // 9. codex_memory_read
  register(
    defineTool({
      name: 'codex_memory_read',
      description:
        'Read a specific markdown file inside ~/.codex/memories_v2 or ~/.codex/memories (strictly read-only and path-jailed). | 只读读取指定 Codex 记忆文件（路径沙箱保护）。',
      parameters: {
        generation: {
          type: 'string',
          enum: ['v2', 'v1'] as const,
          required: true,
          description: 'Codex memory generation ("v2" or "v1").',
        },
        relativePath: {
          type: 'string',
          required: true,
          description: 'Relative path such as "rollout_summaries/<slug>.md" or "extensions/ad_hoc/instructions.md".',
        },
        maxBytes: {
          type: 'integer',
          description: 'Maximum bytes to return (512..131072, default 49152).',
        },
      },
      output: {
        schema: { type: 'json' },
        render: renderJsonText,
      },
      isConcurrencySafe: () => true,
      presentCall: (args) => ({
        card: 'generic',
        kind: 'read',
        title: `Read Codex (${args.generation}): ${args.relativePath}`,
      }),
      async execute(args) {
        const maxBytes =
          typeof args.maxBytes === 'number'
            ? Math.max(512, Math.min(131072, args.maxBytes))
            : 48 * 1024;
        const result = readCodexMemoryFile(
          args.generation,
          args.relativePath,
          runtime.codexHome,
          maxBytes,
        );
        return { readOnly: true, ...result };
      },
    }),
  );
}
