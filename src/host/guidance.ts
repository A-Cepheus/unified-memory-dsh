import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-system-prompt';

export const GUIDANCE_SECTION_NAME = 'unified-memory:guidance';
export const GUIDANCE_SECTION_ORDER = 5000;

/**
 * Compact, prompt-cache-stable static standing instructions for Unified Memory.
 * Kept intentionally concise and deterministic across all workspaces and turns.
 */
export const UNIFIED_MEMORY_GUIDANCE_TEXT = [
  '## Unified Memory Guidelines',
  '',
  'This environment runs **Unified Memory**, bridging **Claude Code Auto Memory** (read-write, v2.1.x schema) with **OpenAI Codex CLI Memory** (strictly read-only), plus automatic loading of `CLAUDE.md` and `.claude/rules/`.',
  '',
  '### 1. Using Loaded Memories',
  '- Treat injected `MEMORY.md`, topic notes, and Codex Global Memory Summary as historical context, not infallible truth — verify cited files, symbols, or commands against the live codebase before relying on them.',
  '- Call `claude_memory_read` for full details behind an entry in `MEMORY.md`, and `codex_memory_search` / `codex_memory_read` for cross-session Codex recall. **Never attempt to write to `~/.codex/`.**',
  '',
  '### 2. Saving Claude Auto Memory (`claude_memory_save`)',
  'Follow Claude Code’s 4-category discipline strictly:',
  '1. `user` — User role, technical expertise, preferences, and recurring workflow habits.',
  '2. `feedback` — Explicit user corrections, constraints, or confirmed approaches (record **why** and **when to apply**).',
  '3. `project` — Ongoing decisions, goals, or external deadlines not derivable from repository files or `git log` (convert relative dates to absolute ISO dates).',
  '4. `reference` — Pointers to external systems (dashboards, trackers, docs, URLs).',
  '',
  '### 3. What Never to Save & Writing Hygiene',
  '- Never save code structure derivable from reading files/`git log`, temporary debug output, rules already in `CLAUDE.md`/`AGENTS.md`, or secrets/tokens/API keys.',
  '- Always use `claude_memory_save` / `claude_memory_delete` instead of directly editing `~/.claude/projects/*/memory/` so v2.1.x `metadata:` frontmatter, cross-process locking, and the 200-line / 25 KB `MEMORY.md` cap stay consistent.',
  '- Check `claude_memory_list` before creating a new topic to avoid duplicates.',
  '- Store memory content in the user’s primary language (e.g., Chinese or English), while keeping YAML frontmatter keys, `type` values, and tool arguments in canonical English.',
].join('\n');

export function registerGuidanceSection(ctx: Context): void {
  ctx.inject(['systemPrompt'], (c) => {
    c.effect(() =>
      c.systemPrompt.section({
        name: GUIDANCE_SECTION_NAME,
        order: GUIDANCE_SECTION_ORDER,
        interpolate: false,
        text: UNIFIED_MEMORY_GUIDANCE_TEXT,
      }),
    );
  });
}
