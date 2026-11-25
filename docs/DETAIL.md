# Unified Memory for DeepSeek Harness

**Unified Memory** brings cross-agent local persistent memory and rule interoperability directly into DeepSeek Harness (`dsh`) across `web`, `desktop`, `headless`, `acp`, and `sdk` profiles.

## What It Provides

### 1. Claude Code Auto Memory (Read-Write, v2.1.x Aligned)
- Uses the exact canonical `~/.claude/projects/<slug>/memory/` directory with Git worktree main-repository resolution (`git rev-parse --git-common-dir`) and deterministic slug encoding.
- Reads legacy flat and v2.1.x nested `metadata:` frontmatter; writes canonical v2.1.x nested metadata with cross-process lockfile (`.unified-memory.lock`) and atomic writes shared safely with Claude Code and `unified-memory-antigravity`.
- Strictly honors the **200-line / 25 KB** `MEMORY.md` startup cap, `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_DISABLE_AUTO_MEMORY`, `autoMemoryEnabled`, and `autoMemoryDirectory`.
- Supports Chinese and English topic names seamlessly (pure CJK names auto-derive deterministic ASCII filenames when omitted).

### 2. Full `CLAUDE.md` & `.claude/rules/` Parity (With Zero Duplication)
- Loads Managed, User (`~/.claude/CLAUDE.md`, `~/.claude/rules/**`), Ancestor, Project (`.claude/CLAUDE.md`, `.claude/rules/**`), and Local rules.
- **Exact Host Deduplication**: Detects files already injected by `dsh-agent-instructions` (`AGENTS.md`, `AGENTS.local.md`, bare `CLAUDE.md`, `CLAUDE.local.md`) so raw bodies are never duplicated while `@import` chains, HTML comment stripping, `claudeMdExcludes`, and conditional `paths:` rules still work seamlessly.
- **Lazy Rule Loading**: Observes file tool results (`read`, `write`, `edit`, `read_image`, `apply_patch`, `str_replace_editor`) to append matching `paths:` rules and subdirectory `CLAUDE.md` files once per session without busting prompt cache prefixes.
- **Fail-Closed External Trust Boundary**: Repository rules referencing out-of-workspace `@import`s or rule symlinks remain blocked until explicitly approved by the user in the **Rules & Context** console tab (or already approved in `~/.claude.json`, read-only).

### 3. OpenAI Codex CLI Memory (Strictly Read-Only)
- Prefers `~/.codex/memories_v2/` with fallback to `~/.codex/memories/`.
- Optionally injects a capped `memory_summary.md` snapshot at session start and provides CJK-friendly full-text search across `rollout_summaries/`, `extensions/ad_hoc/`, `skills/`, and v1 `MEMORY.md` with hard path-jail enforcement and zero writes to `~/.codex/`.

### 4. Prompt-Cache & Lifecycle Discipline
- Injects baseline context once via producer-owned `source: { kind: 'unified-memory' }` messages (compatible with V4 JSONL session persistence & resume).
- Automatically re-injects refreshed baseline context after `/compact` or auto-compaction (`surface.replaceGeneration`).
- Preserves 100% KV-cache reuse for in-process `subagent_fork` sessions by skipping duplicate baseline injection when already present on the inherited session surface.
- Locks resolved locale (`zh` / `en`) per session so mid-session injections remain byte-deterministic.

## Tools, Commands & UI

- **9 Native Model Tools**: `claude_memory_status`, `claude_memory_list`, `claude_memory_read`, `claude_memory_save`, `claude_memory_delete`, `claude_rules_inspect`, `codex_memory_summary`, `codex_memory_search`, `codex_memory_read`.
- **Slash Command**: `/memory [status | list | rules | trust | reload]` (log-only, zero KV-cache impact).
- **Bundled Skills**: `memory-manage` and `memory-dream` (bilingual triggers).
- **Web & Desktop UI**:
  - **Left Sidebar Global Console** with 4 tabs: Overview, Claude Memory, Codex Memory (RO), and Rules & Context.
  - **Right Sidebar Session Context Tab** showing live per-session memory & rule injection status.

## Privacy & Local-Only Guarantee

All operations occur strictly on local plaintext Markdown files (`~/.claude/`, `CLAUDE.md`, `.claude/rules/`, read-only `~/.codex/`, and `$DSH_HOME/storages/unified-memory/`). Zero network calls, zero telemetry, zero credential reading.
