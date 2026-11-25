import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-skill';

const MEMORY_MANAGE_DESCRIPTION =
  'Inspect, search, diagnose, edit, or clean up Claude Code Auto Memory, CLAUDE.md / .claude/rules loading, and read-only Codex CLI memories. Use when the user asks to view memory status (/memory), debug why a rule or memory did or did not load, or manage memories. | 查看、搜索、诊断、编辑或整理跨会话长期记忆、CLAUDE.md/.claude/rules 规则加载状态与只读 Codex 记忆。';

const MEMORY_MANAGE_CONTENT = `# Manage Unified Memory / 管理统一记忆

Use this skill to inspect, diagnose, and manage the user's cross-ecosystem memories and loaded rules inside DeepSeek Harness. Always reply in the user's primary language (Chinese or English).

## Workflow

1. **Interactive Surfaces (Web / Desktop & Slash Command):**
   - Users in DeepSeek Harness Web or Desktop can open the **Unified Memory** page in the left sidebar (Overview, Claude Memory editor, Codex Read-Only explorer, Rules & Context inspector) or the per-session **Memory** tab in the right sidebar.
   - Users can also run \`/memory [status | list | rules | trust | reload]\` directly in chat for zero-token diagnostics.
2. **Diagnostic Status Check:**
   - Call \`claude_memory_status\` to verify Git worktree resolution, project slug encoding, \`memoryDir\` path, and \`MEMORY.md\` line/byte budget (vs 200 lines / 25 KB).
   - Call \`claude_rules_inspect\` to list every loaded \`CLAUDE.md\`, \`@import\` expansion, host-deduped \`dsh-agent-instructions\` files, \`.claude/rules/\` (always-on vs \`paths:\` conditional rules), and any pending external import/symlink approvals.
   - Call \`codex_memory_summary\` to inspect active Codex generation (\`memories_v2\` vs \`memories\`, strictly read-only).
3. **Editing & Searching:**
   - Use \`claude_memory_list\`, \`claude_memory_read\`, \`claude_memory_save\`, and \`claude_memory_delete\` for Claude Code Auto Memory (v2.1.x nested \`metadata:\` format).
   - Use \`codex_memory_search\` and \`codex_memory_read\` for read-only Codex lookups. **Never modify anything under \`~/.codex/\`.**
   - Store memory notes in the user's language (Chinese or English) while keeping YAML frontmatter keys and \`type\` values (\`user | feedback | project | reference\`) in English.
`;

const MEMORY_DREAM_DESCRIPTION =
  'Consolidate, deduplicate, prune stale entries, and keep Claude Code Auto Memory (MEMORY.md + topic files) healthy under the 200-line / 25 KB index budget — equivalent to Claude Code Auto Dream. Use when asked to clean up, audit, consolidate, or dream-prune memories. | 整理、去重、清理过期记忆，保持 Claude 自动记忆（MEMORY.md 与主题文件）在 200 行 / 25 KB 上限内健康精简（对应 Auto Dream 记忆维护）。';

const MEMORY_DREAM_CONTENT = `# Memory Consolidation ("Auto Dream") / 记忆整理与去重

Run a structured hygiene pass over the current project's Claude Code Auto Memory (\`~/.claude/projects/<slug>/memory/\`). **Never modify \`~/.codex/\` (strictly read-only).** Reply in the user's primary language (Chinese or English).

## Steps

1. **Inventory Current State:**
   - Call \`claude_memory_status\` and \`claude_memory_list\` for the active workspace.
   - Read \`MEMORY.md\` and inspect each topic file via \`claude_memory_read\`.
2. **Audit Against Live Reality:**
   - Verify whether cited file paths, symbols, commands, or architectural constraints still exist in the current workspace.
   - Identify:
     - **Duplicates / overlapping topics** that should be merged into one focused file.
     - **Contradictions** where newer feedback or decisions supersede older notes.
     - **Stale or derivable noise** (finished temporary tasks, facts already in \`CLAUDE.md\` or easily read from code).
     - **Index hygiene**: broken links in \`MEMORY.md\`, orphan topic files missing from \`MEMORY.md\`, or \`MEMORY.md\` approaching 200 lines / 25 KB.
3. **Propose & Apply Safely:**
   - Summarize proposed merges, updates, and deletions clearly before destructive removals if anything looks ambiguous; for unambiguous dead links or duplicates, apply via \`claude_memory_save\` and \`claude_memory_delete\`.
   - Keep every surviving topic concise (description <= 150 chars in \`MEMORY.md\`), valid \`user | feedback | project | reference\` category, and written in the user's primary language.
4. **Report Result:**
   - Re-run \`claude_memory_status\` and report before/after topic counts and \`MEMORY.md\` line/byte usage.
`;

export function registerBundledSkills(ctx: Context): void {
  ctx.inject(['skills'], (c) => {
    c.effect(() =>
      c.skills.register({
        name: 'memory-manage',
        description: MEMORY_MANAGE_DESCRIPTION,
        content: MEMORY_MANAGE_CONTENT,
        source: 'bundled',
      }),
    );
    c.effect(() =>
      c.skills.register({
        name: 'memory-dream',
        description: MEMORY_DREAM_DESCRIPTION,
        content: MEMORY_DREAM_CONTENT,
        source: 'bundled',
      }),
    );
  });
}
