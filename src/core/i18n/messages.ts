export type ResolvedLocale = 'zh' | 'en';

export type LocalePreference = 'auto' | 'zh' | 'en';

export interface CoreMessageCatalog {
  // Baseline & lazy-load context headers (prompt-cache deterministic — never include timestamps)
  baselineHeaderSessionStart: string;
  baselineHeaderCompactionReload: string;
  lazyHeaderScopedRules: string;
  sectionGlobalClaudeInstructions: string;
  sectionProjectClaudeInstructions: (wsName: string, wsRoot: string) => string;
  sectionClaudeMemoryIndex: (wsName: string) => string;
  sectionClaudeMemoryEmpty: (wsName: string) => string;
  sectionCodexSummary: (generation: 'v2' | 'v1') => string;
  sectionCodexGlobalAgents: (filename: string) => string;

  // Subtitles & guidance lines inside injected context
  claudeMemoryCanonicalDirLine: (memoryDir: string, slug: string, isGitWorktree: boolean) => string;
  claudeMemoryToolsHintLine: string;
  claudeMemoryEmptyLine: (memoryDir: string) => string;
  claudeMemoryTruncatedNote: (
    includedLines: number,
    totalLines: number,
    includedKb: string,
    totalKb: string,
  ) => string;
  codexReadOnlyNoticeLine: string;
  codexSummaryTruncatedNote: (maxKb: string) => string;
  startupContextTruncatedNote: (maxKb: string) => string;
  pendingExternalRuleNotice: (pendingCount: number) => string;
  hostDedupedImportOnlySubtitle: (displayPath: string) => string;
  scopedRuleMatchedSubtitle: (displayPath: string, triggeredBy: string) => string;
  subdirClaudeMdTriggeredSubtitle: (displayPath: string, triggeredBy: string) => string;

  // Core memory CRUD warnings & tool responses
  memoryIndexExceededWarning: (totalLines: number, totalKb: string) => string;
  memoryIndexApproachingWarning: (totalLines: number, totalKb: string) => string;
  autoMemoryDisabledError: string;
  topicNotFoundError: (filename: string, memoryDir: string) => string;
  externalTargetsApprovalNote: string;

  // Slash command (`/memory`) labels
  cmdTitle: string;
  cmdUsageHint: string;
  cmdStatusLineLocale: (resolved: ResolvedLocale, pref: LocalePreference) => string;
  cmdStatusLineWorkspace: (cwd: string, resolvedRoot: string, isWorktree: boolean) => string;
  cmdStatusLineClaude: (slug: string, memoryDir: string, enabled: boolean, exists: boolean) => string;
  cmdStatusLineIndex: (lines: number, maxLines: number, kb: string, truncated: boolean) => string;
  cmdStatusLineTopics: (count: number) => string;
  cmdStatusLineCodex: (generation: string, codexHome: string) => string;
  cmdStatusLineSession: (
    baselineInjected: boolean,
    compactionCount: number,
    hostDedupedCount: number,
    lazyRuleCount: number,
  ) => string;
  cmdReloadNotice: string;
  cmdNoTopics: string;
  cmdNoExternalPending: string;
}

const EN_MESSAGES: CoreMessageCatalog = {
  baselineHeaderSessionStart:
    '[Unified Memory — Session Context (Claude Rules + Claude Auto Memory + Codex Read-Only)]',
  baselineHeaderCompactionReload: '[Unified Memory — Baseline Re-injected After Compaction]',
  lazyHeaderScopedRules: '[Unified Memory — Dynamically Loaded Scoped Rules]',
  sectionGlobalClaudeInstructions: '## Global Claude Instructions',
  sectionProjectClaudeInstructions: (wsName, wsRoot) =>
    `## Project Claude Instructions (${wsName} — ${wsRoot})`,
  sectionClaudeMemoryIndex: (wsName) => `## Claude Auto Memory Index (${wsName})`,
  sectionClaudeMemoryEmpty: (wsName) => `## Claude Auto Memory (${wsName})`,
  sectionCodexSummary: (generation) =>
    `## Codex Global Memory Summary (Read-Only, ${generation})`,
  sectionCodexGlobalAgents: (filename) => `## Codex Global Instructions (${filename})`,

  claudeMemoryCanonicalDirLine: (memoryDir, slug, isGitWorktree) =>
    `- Canonical memory dir: \`${memoryDir}\` (slug: \`${slug}\`${isGitWorktree ? ', resolved via Git main worktree' : ''})`,
  claudeMemoryToolsHintLine:
    '- Use tools `claude_memory_read` / `claude_memory_save` / `claude_memory_delete` to inspect or update topic files.',
  claudeMemoryEmptyLine: (memoryDir) =>
    `- Canonical memory dir: \`${memoryDir}\` (no MEMORY.md entries yet; use \`claude_memory_save\` when worth remembering).`,
  claudeMemoryTruncatedNote: (includedLines, totalLines, includedKb, totalKb) =>
    `> [Truncated to ${includedLines}/${totalLines} lines, ${includedKb}/${totalKb} KB per Claude Code 200-line / 25 KB cap]`,
  codexReadOnlyNoticeLine:
    '> Strictly read-only cross-repo summary from `~/.codex`. Never write to `~/.codex/`; use `codex_memory_search` for rollout summaries or extensions.',
  codexSummaryTruncatedNote: (maxKb) =>
    `> [Codex global summary truncated to ${maxKb} KB; use \`codex_memory_search\` / \`codex_memory_read\` for deeper details]`,
  startupContextTruncatedNote: (maxKb) =>
    `> [Unified Memory startup context truncated to ${maxKb} KB budget]`,
  pendingExternalRuleNotice: (pendingCount) =>
    `> [Unified Memory] Skipped ${pendingCount} unapproved external rule import(s)/symlink(s) outside this workspace. Open the Unified Memory console (Rules & Context tab) or run \`/memory trust\` to review and approve if trusted.`,
  hostDedupedImportOnlySubtitle: (displayPath) =>
    `${displayPath} (@import expansions — base body already loaded natively by DeepSeek Harness)`,
  scopedRuleMatchedSubtitle: (displayPath, triggeredBy) =>
    `${displayPath} (path-scoped rule matched \`${triggeredBy}\`)`,
  subdirClaudeMdTriggeredSubtitle: (displayPath, triggeredBy) =>
    `${displayPath} (subdirectory CLAUDE.md triggered by \`${triggeredBy}\`)`,

  memoryIndexExceededWarning: (totalLines, totalKb) =>
    `MEMORY.md exceeds Claude Code's 200-line / 25 KB startup limit (${totalLines} lines, ${totalKb} KB). Consider running memory consolidation.`,
  memoryIndexApproachingWarning: (totalLines, totalKb) =>
    `MEMORY.md is approaching the 200-line / 25 KB startup limit (${totalLines}/200 lines, ${totalKb}/25 KB).`,
  autoMemoryDisabledError:
    'Claude Auto Memory is disabled in settings or via CLAUDE_CODE_DISABLE_AUTO_MEMORY.',
  topicNotFoundError: (filename, memoryDir) =>
    `Topic file "${filename}" not found in ${memoryDir}`,
  externalTargetsApprovalNote:
    'External targets outside this workspace require user approval in the Unified Memory console (Rules & Context tab) or via `/memory trust`.',

  cmdTitle: 'Unified Memory Status',
  cmdUsageHint: 'Usage: /memory [status | list | rules | trust | reload]',
  cmdStatusLineLocale: (resolved, pref) => `Locale: ${resolved} (config: ${pref})`,
  cmdStatusLineWorkspace: (cwd, resolvedRoot, isWorktree) =>
    `Workspace: ${cwd}${isWorktree ? ` -> Git main root: ${resolvedRoot}` : ''}`,
  cmdStatusLineClaude: (slug, memoryDir, enabled, exists) =>
    `Claude Auto Memory: ${enabled ? (exists ? 'ready' : 'not initialized yet') : 'disabled'} | slug=${slug} | dir=${memoryDir}`,
  cmdStatusLineIndex: (lines, maxLines, kb, truncated) =>
    `MEMORY.md: ${lines}/${maxLines} lines, ${kb}/25.0 KB${truncated ? ' (TRUNCATED)' : ''}`,
  cmdStatusLineTopics: (count) => `Topic notes: ${count}`,
  cmdStatusLineCodex: (generation, codexHome) =>
    `Codex Memory (RO): generation=${generation} | home=${codexHome}`,
  cmdStatusLineSession: (baselineInjected, compactionCount, hostDedupedCount, lazyRuleCount) =>
    `Session: baseline=${baselineInjected ? 'injected' : 'pending'} | compactions=${compactionCount} | host-deduped=${hostDedupedCount} | lazy-rules=${lazyRuleCount}`,
  cmdReloadNotice:
    'Scheduled baseline memory & rules refresh for the next model step in this session.',
  cmdNoTopics: 'No Claude Auto Memory topic notes exist for this workspace yet.',
  cmdNoExternalPending: 'No unapproved external @imports or rule symlinks detected in this workspace.',
};

const ZH_MESSAGES: CoreMessageCatalog = {
  baselineHeaderSessionStart:
    '[Unified Memory — 会话上下文（Claude 规则 + Claude 自动记忆 + Codex 只读摘要）]',
  baselineHeaderCompactionReload: '[Unified Memory — 上下文压实后已重新注入基线记忆与规则]',
  lazyHeaderScopedRules: '[Unified Memory — 按需动态加载的条件规则]',
  sectionGlobalClaudeInstructions: '## 全局 Claude 规则',
  sectionProjectClaudeInstructions: (wsName, wsRoot) =>
    `## 项目 Claude 规则（${wsName} — ${wsRoot}）`,
  sectionClaudeMemoryIndex: (wsName) => `## Claude 自动记忆索引（${wsName}）`,
  sectionClaudeMemoryEmpty: (wsName) => `## Claude 自动记忆（${wsName}）`,
  sectionCodexSummary: (generation) =>
    `## Codex 全局记忆摘要（严格只读，${generation}）`,
  sectionCodexGlobalAgents: (filename) => `## Codex 全局指令（${filename}）`,

  claudeMemoryCanonicalDirLine: (memoryDir, slug, isGitWorktree) =>
    `- 规范记忆目录：\`${memoryDir}\`（slug：\`${slug}\`${isGitWorktree ? '，已解析至 Git 主仓库根' : ''}）`,
  claudeMemoryToolsHintLine:
    '- 请使用 `claude_memory_read` / `claude_memory_save` / `claude_memory_delete` 工具读取或更新主题记忆文件。',
  claudeMemoryEmptyLine: (memoryDir) =>
    `- 规范记忆目录：\`${memoryDir}\`（尚无 MEMORY.md 条目；有值得跨会话记住的信息时请调用 \`claude_memory_save\`）。`,
  claudeMemoryTruncatedNote: (includedLines, totalLines, includedKb, totalKb) =>
    `> [已按 Claude Code 200 行 / 25 KB 启动上限截断：显示 ${includedLines}/${totalLines} 行，${includedKb}/${totalKb} KB]`,
  codexReadOnlyNoticeLine:
    '> 来自 `~/.codex` 的跨仓库只读摘要。严禁写入 `~/.codex/`；如需深入查阅历史 rollout 或扩展笔记，请调用 `codex_memory_search`。',
  codexSummaryTruncatedNote: (maxKb) =>
    `> [Codex 全局摘要已截断至 ${maxKb} KB；如需更多细节请使用 \`codex_memory_search\` / \`codex_memory_read\`]`,
  startupContextTruncatedNote: (maxKb) =>
    `> [Unified Memory 启动注入上下文已按 ${maxKb} KB 预算截断]`,
  pendingExternalRuleNotice: (pendingCount) =>
    `> [Unified Memory] 已拦截 ${pendingCount} 项指向工作区外部且未授权的规则 @import / 符号链接。请打开 Unified Memory 控制台（“规则与上下文”标签页）或执行 \`/memory trust\` 审查并授权。`,
  hostDedupedImportOnlySubtitle: (displayPath) =>
    `${displayPath}（仅 @import 展开内容 —— 原始正文已由 DeepSeek Harness 原生加载）`,
  scopedRuleMatchedSubtitle: (displayPath, triggeredBy) =>
    `${displayPath}（路径条件规则，命中 \`${triggeredBy}\`）`,
  subdirClaudeMdTriggeredSubtitle: (displayPath, triggeredBy) =>
    `${displayPath}（子目录 CLAUDE.md，由 \`${triggeredBy}\` 触发）`,

  memoryIndexExceededWarning: (totalLines, totalKb) =>
    `MEMORY.md 已超出 Claude Code 的 200 行 / 25 KB 启动上限（当前 ${totalLines} 行，${totalKb} KB），建议执行记忆整理（memory-dream）。`,
  memoryIndexApproachingWarning: (totalLines, totalKb) =>
    `MEMORY.md 接近 200 行 / 25 KB 启动上限（当前 ${totalLines}/200 行，${totalKb}/25 KB）。`,
  autoMemoryDisabledError:
    'Claude 自动记忆已在配置中关闭或设置了 CLAUDE_CODE_DISABLE_AUTO_MEMORY。',
  topicNotFoundError: (filename, memoryDir) =>
    `未在 ${memoryDir} 中找到主题记忆文件 "${filename}"`,
  externalTargetsApprovalNote:
    '指向工作区外部的规则目标需要用户在 Unified Memory 控制台（“规则与上下文”标签页）或通过 `/memory trust` 手动批准。',

  cmdTitle: 'Unified Memory 记忆状态',
  cmdUsageHint: '用法：/memory [status | list | rules | trust | reload]',
  cmdStatusLineLocale: (resolved, pref) => `当前语言：${resolved}（配置：${pref}）`,
  cmdStatusLineWorkspace: (cwd, resolvedRoot, isWorktree) =>
    `当前工作区：${cwd}${isWorktree ? ` -> Git 主仓库根：${resolvedRoot}` : ''}`,
  cmdStatusLineClaude: (slug, memoryDir, enabled, exists) =>
    `Claude 自动记忆：${enabled ? (exists ? '已就绪' : '尚未初始化') : '已禁用'} | slug=${slug} | 目录=${memoryDir}`,
  cmdStatusLineIndex: (lines, maxLines, kb, truncated) =>
    `MEMORY.md：${lines}/${maxLines} 行，${kb}/25.0 KB${truncated ? '（已截断）' : ''}`,
  cmdStatusLineTopics: (count) => `主题记忆数：${count}`,
  cmdStatusLineCodex: (generation, codexHome) =>
    `Codex 记忆（只读）：代次=${generation} | 目录=${codexHome}`,
  cmdStatusLineSession: (baselineInjected, compactionCount, hostDedupedCount, lazyRuleCount) =>
    `当前会话：基线=${baselineInjected ? '已注入' : '待注入'} | 压实重载=${compactionCount} | 宿主去重=${hostDedupedCount} | 懒加载规则=${lazyRuleCount}`,
  cmdReloadNotice: '已预约在当前会话的下一轮模型步骤重新注入最新基线记忆与规则。',
  cmdNoTopics: '当前工作区尚无 Claude 自动记忆主题文件。',
  cmdNoExternalPending: '当前工作区未检测到待审批的外部规则 @import 或符号链接。',
};

export const CORE_MESSAGES: Record<ResolvedLocale, CoreMessageCatalog> = {
  en: EN_MESSAGES,
  zh: ZH_MESSAGES,
};
