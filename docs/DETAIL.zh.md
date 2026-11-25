# Unified Memory（DeepSeek Harness 统一记忆插件）

**Unified Memory** 为 DeepSeek Harness（`dsh`）提供跨 AI 编码代理的本地持久记忆与规则互通能力，一套零编译原生插件包完整覆盖 `web`、`desktop`、`headless`、`acp` 与 `sdk` 全部运行模式。

## 核心能力

### 1. Claude Code 自动记忆（读写互通，对齐 v2.1.x）
- 精确复用 `~/.claude/projects/<slug>/memory/` 存储目录，完整支持 Git worktree 主仓库根解析（`git rev-parse --git-common-dir`）与确定性 slug 编码。
- 读取兼容旧版扁平与 v2.1.x 嵌套 `metadata:` Frontmatter；写入统一输出规范 v2.1.x 嵌套元数据，并通过跨进程文件锁（`.unified-memory.lock`）与原子写入，与 Claude Code 及 `unified-memory-antigravity` 安全并发共享。
- 严格遵循 `MEMORY.md` 的 **200 行 / 25 KB** 启动预算上限，以及 `CLAUDE_CONFIG_DIR`、`CLAUDE_CODE_DISABLE_AUTO_MEMORY`、`autoMemoryEnabled`、`autoMemoryDirectory` 原生配置。
- 原生支持中文主题名（未显式指定文件名时，纯中文标题自动生成确定性 ASCII 文件名）。

### 2. 完整 `CLAUDE.md` 与 `.claude/rules/` 兼容（精准去重零冗余）
- 按 Claude Code 优先级加载 Managed、用户全局（`~/.claude/CLAUDE.md`、`~/.claude/rules/**`）、祖先目录、项目级（`.claude/CLAUDE.md`、`.claude/rules/**`）与本地规则。
- **运行时宿主精准去重**：自动识别已由 `dsh-agent-instructions` 加载的 `AGENTS.md`、`AGENTS.local.md` 及裸 `CLAUDE.md` / `CLAUDE.local.md`，跳过重复正文注入的同时继续展开其 `@import` 链、剥离 HTML 注释、应用 `claudeMdExcludes` 并支持条件规则。
- **按需懒加载**：监听文件工具调用结果（`read`、`write`、`edit`、`read_image`、`apply_patch`、`str_replace_editor`），命中的 `paths:` 规则和子目录 `CLAUDE.md` 在当前会话仅追加注入一次，不破坏前缀缓存。
- **外部导入与软链安全边界**：仓库级规则指向工作区外部的 `@import` 或规则符号链接默认拦截，仅在用户在 **规则与上下文** 控制台手动批准（或只读复用 `~/.claude.json` 已批准记录）后才允许加载。

### 3. OpenAI Codex CLI 记忆（严格只读）
- 优先读取 `~/.codex/memories_v2/` 并自动回退至 `~/.codex/memories/`。
- 启动时按配置注入定长 `memory_summary.md` 摘要，并提供面向中英文（含中文标点切分与双字检索）的全文检索工具，覆盖 `rollout_summaries/`、`extensions/ad_hoc/`、`skills/` 与 v1 `MEMORY.md`，路径沙箱强制只读、对 `~/.codex/` 零写入。

### 4. Prompt Cache 与会话生命周期治理
- 使用插件自有消息来源 `source: { kind: 'unified-memory' }` 注入上下文，100% 兼容 V4 JSONL 会话持久化与恢复，在聊天界面渲染为干净的折叠披露条。
- 监测 `surface.replaceGeneration`，在手动 `/compact` 或自动压实后自动重载最新基线记忆与规则。
- 对进程内 `subagent_fork` 子代理自动识别已继承表面基线并跳过重复注入，最大化复用父会话 KV-Cache。
- 会话内锁定已解析的语言（`zh` / `en`），确保跨轮次注入文本字节级确定。

## 工具、命令与原生界面

- **9 个原生模型工具**：`claude_memory_status`、`claude_memory_list`、`claude_memory_read`、`claude_memory_save`、`claude_memory_delete`、`claude_rules_inspect`、`codex_memory_summary`、`codex_memory_search`、`codex_memory_read`。
- **Slash 命令**：`/memory [status | list | rules | trust | reload]`（仅日志记录，零 Token 与 KV-Cache 开销）。
- **内置技能**：`memory-manage` 与 `memory-dream`（中英双语触发词）。
- **Web 与 Desktop 原生界面**：
  - **左侧边栏全局控制台**：总览、Claude 记忆、Codex 记忆（只读）、规则与上下文四大标签页。
  - **右侧边栏会话上下文面板**：实时查看当前会话的语言、基线状态、压实重载次数、宿主去重与按需加载规则。

## 本地隐私声明

本插件 100% 在本地文件系统运行，仅访问本地明文 Markdown 记忆与规则文件（`~/.claude/`、`CLAUDE.md`、`.claude/rules/`、严格只读的 `~/.codex/` 以及 `$DSH_HOME/storages/unified-memory/`），绝不发起外部网络请求、绝不收集遥测、绝不读取凭据或 Token。
