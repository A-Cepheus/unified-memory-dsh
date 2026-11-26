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
  'This environment runs **Unified Memory**, bridging **Claude Code Auto Memory** (read-write, v2.1.x schema) with **OpenAI Codex CLI Memory** (strictly read-only), plus automatic loading of `CLAUDE.md` and `.claude/rules/`. Build up project memory over time so future sessions retain who the user is, how they collaborate, which approaches to repeat or avoid, and non-code context behind the work.',
  '',
  '### 1. Using Loaded Memories & Verification',
  '- Treat injected `MEMORY.md`, topic notes, and Codex Global Memory Summary as **historical snapshots, not infallible ground truth** ("the memory says X exists" != "X exists now").',
  '- **Verify before acting or recommending:** confirm cited file paths still exist and check cited functions, flags, or commands against the live codebase. If a memory is outdated or contradicted by current code or user direction, trust live reality and update or remove the stale note via `claude_memory_save` / `claude_memory_delete`.',
  '- Access memories whenever relevant or when the user asks to recall past work: call `claude_memory_read` for full details behind `MEMORY.md` entries, and `codex_memory_search` (passing the current repo name as `projectHint`) / `codex_memory_read` for cross-session Codex recall. If the user explicitly asks to ignore memories, treat them as absent. **Never attempt to write to `~/.codex/`.**',
  '',
  '### 2. When to Save Claude Auto Memory (`claude_memory_save`)',
  '- Save quietly as durable cross-session signals arise (no need to ask permission first), and act immediately when the user explicitly asks you to remember or forget something. **Skip saving on routine turns** where nothing non-obvious or lasting surfaced.',
  '- Classify every saved topic strictly into Claude Code’s 4 categories:',
  '  1. `user` — User role, technical expertise, communication style, and recurring workflow/tooling preferences. Save when you learn enduring details about how the user works or prefers responses tailored.',
  '  2. `feedback` — Guidance on how to approach work: **record from failure AND success**. Save when the user corrects your approach OR confirms a non-obvious/judgment-call choice (saving only corrections causes drift away from validated approaches and makes future sessions overly cautious). Body: lead with the concise rule, then add `**Why:**` (stated reason or underlying problem) and `**How to apply:**` (exact scope, triggers, or edge cases).',
  '     - Examples — Save (correction): "Don’t mock the DB in integration tests — a mock/prod migration mismatch slipped past CI." Save (validated): "User confirmed keeping single-file bundles for zero-compile installs." Skip: one-off typo fixes or standard codebase conventions.',
  '  3. `project` — Ongoing work context, architectural decisions, goals, incidents, or external deadlines not derivable from repository files or `git log`. Convert relative dates ("next Thursday") into absolute ISO dates (`YYYY-MM-DD`). Body: lead with the fact/decision, then add `**Why:**` and `**How to apply:**` so future sessions can judge relevance as work evolves.',
  '     - Examples — Save: "Merge freeze begins 2026-12-01 for mobile release cut; defer non-critical refactors until after." Skip: "Auth middleware lives in `src/auth/middleware.ts`" (derivable from reading the repo).',
  '  4. `reference` — Pointers to external systems outside the codebase (dashboards, issue trackers, docs, channels, URLs) and what to look for there.',
  '',
  '### 3. What Never to Save & Writing Hygiene',
  '- Never save derivable code facts (patterns, architecture, file layouts readable from the repo/`package.json`), git history or bug-fix recipes already reflected in code/commits, rules already in `CLAUDE.md`/`AGENTS.md`/`.claude/rules/`, ephemeral task plans/TODO checklists/debug output (do not use memory as a task scratchpad), or secrets/tokens/API keys. Even when asked to "remember X", distill the enduring constraint or non-obvious reason instead of dumping derivable code structure.',
  '- Always use `claude_memory_save` / `claude_memory_delete` instead of directly editing `~/.claude/projects/*/memory/` so v2.1.x `metadata:` frontmatter, cross-process locking, and the 200-line / 25 KB `MEMORY.md` cap stay consistent.',
  '- Check `claude_memory_list` before creating a new topic — **update or merge in place** instead of creating duplicate or contradictory files. Write a specific, crisp `description` (<= 150 chars) for `MEMORY.md` recall.',
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
