// src/host/index.ts
import z from "@deepseek-ai/schemastery";

// src/core/types.ts
var CLAUDE_MEMORY_TYPES = [
  "user",
  "feedback",
  "project",
  "reference"
];
var DEFAULT_CONFIG = {
  locale: "auto",
  injectCodexSummaryOnStart: true,
  codexSummaryMaxBytes: 8 * 1024,
  injectCodexGlobalAgentsMd: false,
  deduplicateNativeAgentsMd: true,
  maxStartupInjectBytes: 64 * 1024,
  trustClaudeCodeExternalApprovals: true,
  externalRuleTrust: {}
};

// src/core/i18n/messages.ts
var EN_MESSAGES = {
  baselineHeaderSessionStart: "[Unified Memory \u2014 Session Context (Claude Rules + Claude Auto Memory + Codex Read-Only)]",
  baselineHeaderCompactionReload: "[Unified Memory \u2014 Baseline Re-injected After Compaction]",
  lazyHeaderScopedRules: "[Unified Memory \u2014 Dynamically Loaded Scoped Rules]",
  sectionGlobalClaudeInstructions: "## Global Claude Instructions",
  sectionProjectClaudeInstructions: (wsName, wsRoot) => `## Project Claude Instructions (${wsName} \u2014 ${wsRoot})`,
  sectionClaudeMemoryIndex: (wsName) => `## Claude Auto Memory Index (${wsName})`,
  sectionClaudeMemoryEmpty: (wsName) => `## Claude Auto Memory (${wsName})`,
  sectionCodexSummary: (generation) => `## Codex Global Memory Summary (Read-Only, ${generation})`,
  sectionCodexGlobalAgents: (filename) => `## Codex Global Instructions (${filename})`,
  claudeMemoryCanonicalDirLine: (memoryDir, slug, isGitWorktree) => `- Canonical memory dir: \`${memoryDir}\` (slug: \`${slug}\`${isGitWorktree ? ", resolved via Git main worktree" : ""})`,
  claudeMemoryToolsHintLine: "- Use tools `claude_memory_read` / `claude_memory_save` / `claude_memory_delete` to inspect or update topic files.",
  claudeMemoryEmptyLine: (memoryDir) => `- Canonical memory dir: \`${memoryDir}\` (no MEMORY.md entries yet; use \`claude_memory_save\` when worth remembering).`,
  claudeMemoryTruncatedNote: (includedLines, totalLines, includedKb, totalKb) => `> [Truncated to ${includedLines}/${totalLines} lines, ${includedKb}/${totalKb} KB per Claude Code 200-line / 25 KB cap]`,
  codexReadOnlyNoticeLine: "> Strictly read-only cross-repo summary from `~/.codex`. Never write to `~/.codex/`; use `codex_memory_search` for rollout summaries or extensions.",
  codexSummaryTruncatedNote: (maxKb) => `> [Codex global summary truncated to ${maxKb} KB; use \`codex_memory_search\` / \`codex_memory_read\` for deeper details]`,
  startupContextTruncatedNote: (maxKb) => `> [Unified Memory startup context truncated to ${maxKb} KB budget]`,
  pendingExternalRuleNotice: (pendingCount) => `> [Unified Memory] Skipped ${pendingCount} unapproved external rule import(s)/symlink(s) outside this workspace. Open the Unified Memory console (Rules & Context tab) or run \`/memory trust\` to review and approve if trusted.`,
  hostDedupedImportOnlySubtitle: (displayPath) => `${displayPath} (@import expansions \u2014 base body already loaded natively by DeepSeek Harness)`,
  scopedRuleMatchedSubtitle: (displayPath, triggeredBy) => `${displayPath} (path-scoped rule matched \`${triggeredBy}\`)`,
  subdirClaudeMdTriggeredSubtitle: (displayPath, triggeredBy) => `${displayPath} (subdirectory CLAUDE.md triggered by \`${triggeredBy}\`)`,
  memoryIndexExceededWarning: (totalLines, totalKb) => `MEMORY.md exceeds Claude Code's 200-line / 25 KB startup limit (${totalLines} lines, ${totalKb} KB). Consider running memory consolidation.`,
  memoryIndexApproachingWarning: (totalLines, totalKb) => `MEMORY.md is approaching the 200-line / 25 KB startup limit (${totalLines}/200 lines, ${totalKb}/25 KB).`,
  autoMemoryDisabledError: "Claude Auto Memory is disabled in settings or via CLAUDE_CODE_DISABLE_AUTO_MEMORY.",
  topicNotFoundError: (filename, memoryDir) => `Topic file "${filename}" not found in ${memoryDir}`,
  externalTargetsApprovalNote: "External targets outside this workspace require user approval in the Unified Memory console (Rules & Context tab) or via `/memory trust`.",
  cmdTitle: "Unified Memory Status",
  cmdUsageHint: "Usage: /memory [status | list | rules | trust | reload]",
  cmdStatusLineLocale: (resolved, pref) => `Locale: ${resolved} (config: ${pref})`,
  cmdStatusLineWorkspace: (cwd, resolvedRoot, isWorktree) => `Workspace: ${cwd}${isWorktree ? ` -> Git main root: ${resolvedRoot}` : ""}`,
  cmdStatusLineClaude: (slug, memoryDir, enabled, exists) => `Claude Auto Memory: ${enabled ? exists ? "ready" : "not initialized yet" : "disabled"} | slug=${slug} | dir=${memoryDir}`,
  cmdStatusLineIndex: (lines, maxLines, kb, truncated) => `MEMORY.md: ${lines}/${maxLines} lines, ${kb}/25.0 KB${truncated ? " (TRUNCATED)" : ""}`,
  cmdStatusLineTopics: (count) => `Topic notes: ${count}`,
  cmdStatusLineCodex: (generation, codexHome) => `Codex Memory (RO): generation=${generation} | home=${codexHome}`,
  cmdStatusLineSession: (baselineInjected, compactionCount, hostDedupedCount, lazyRuleCount) => `Session: baseline=${baselineInjected ? "injected" : "pending"} | compactions=${compactionCount} | host-deduped=${hostDedupedCount} | lazy-rules=${lazyRuleCount}`,
  cmdReloadNotice: "Scheduled baseline memory & rules refresh for the next model step in this session.",
  cmdNoTopics: "No Claude Auto Memory topic notes exist for this workspace yet.",
  cmdNoExternalPending: "No unapproved external @imports or rule symlinks detected in this workspace."
};
var ZH_MESSAGES = {
  baselineHeaderSessionStart: "[Unified Memory \u2014 \u4F1A\u8BDD\u4E0A\u4E0B\u6587\uFF08Claude \u89C4\u5219 + Claude \u81EA\u52A8\u8BB0\u5FC6 + Codex \u53EA\u8BFB\u6458\u8981\uFF09]",
  baselineHeaderCompactionReload: "[Unified Memory \u2014 \u4E0A\u4E0B\u6587\u538B\u5B9E\u540E\u5DF2\u91CD\u65B0\u6CE8\u5165\u57FA\u7EBF\u8BB0\u5FC6\u4E0E\u89C4\u5219]",
  lazyHeaderScopedRules: "[Unified Memory \u2014 \u6309\u9700\u52A8\u6001\u52A0\u8F7D\u7684\u6761\u4EF6\u89C4\u5219]",
  sectionGlobalClaudeInstructions: "## \u5168\u5C40 Claude \u89C4\u5219",
  sectionProjectClaudeInstructions: (wsName, wsRoot) => `## \u9879\u76EE Claude \u89C4\u5219\uFF08${wsName} \u2014 ${wsRoot}\uFF09`,
  sectionClaudeMemoryIndex: (wsName) => `## Claude \u81EA\u52A8\u8BB0\u5FC6\u7D22\u5F15\uFF08${wsName}\uFF09`,
  sectionClaudeMemoryEmpty: (wsName) => `## Claude \u81EA\u52A8\u8BB0\u5FC6\uFF08${wsName}\uFF09`,
  sectionCodexSummary: (generation) => `## Codex \u5168\u5C40\u8BB0\u5FC6\u6458\u8981\uFF08\u4E25\u683C\u53EA\u8BFB\uFF0C${generation}\uFF09`,
  sectionCodexGlobalAgents: (filename) => `## Codex \u5168\u5C40\u6307\u4EE4\uFF08${filename}\uFF09`,
  claudeMemoryCanonicalDirLine: (memoryDir, slug, isGitWorktree) => `- \u89C4\u8303\u8BB0\u5FC6\u76EE\u5F55\uFF1A\`${memoryDir}\`\uFF08slug\uFF1A\`${slug}\`${isGitWorktree ? "\uFF0C\u5DF2\u89E3\u6790\u81F3 Git \u4E3B\u4ED3\u5E93\u6839" : ""}\uFF09`,
  claudeMemoryToolsHintLine: "- \u8BF7\u4F7F\u7528 `claude_memory_read` / `claude_memory_save` / `claude_memory_delete` \u5DE5\u5177\u8BFB\u53D6\u6216\u66F4\u65B0\u4E3B\u9898\u8BB0\u5FC6\u6587\u4EF6\u3002",
  claudeMemoryEmptyLine: (memoryDir) => `- \u89C4\u8303\u8BB0\u5FC6\u76EE\u5F55\uFF1A\`${memoryDir}\`\uFF08\u5C1A\u65E0 MEMORY.md \u6761\u76EE\uFF1B\u6709\u503C\u5F97\u8DE8\u4F1A\u8BDD\u8BB0\u4F4F\u7684\u4FE1\u606F\u65F6\u8BF7\u8C03\u7528 \`claude_memory_save\`\uFF09\u3002`,
  claudeMemoryTruncatedNote: (includedLines, totalLines, includedKb, totalKb) => `> [\u5DF2\u6309 Claude Code 200 \u884C / 25 KB \u542F\u52A8\u4E0A\u9650\u622A\u65AD\uFF1A\u663E\u793A ${includedLines}/${totalLines} \u884C\uFF0C${includedKb}/${totalKb} KB]`,
  codexReadOnlyNoticeLine: "> \u6765\u81EA `~/.codex` \u7684\u8DE8\u4ED3\u5E93\u53EA\u8BFB\u6458\u8981\u3002\u4E25\u7981\u5199\u5165 `~/.codex/`\uFF1B\u5982\u9700\u6DF1\u5165\u67E5\u9605\u5386\u53F2 rollout \u6216\u6269\u5C55\u7B14\u8BB0\uFF0C\u8BF7\u8C03\u7528 `codex_memory_search`\u3002",
  codexSummaryTruncatedNote: (maxKb) => `> [Codex \u5168\u5C40\u6458\u8981\u5DF2\u622A\u65AD\u81F3 ${maxKb} KB\uFF1B\u5982\u9700\u66F4\u591A\u7EC6\u8282\u8BF7\u4F7F\u7528 \`codex_memory_search\` / \`codex_memory_read\`]`,
  startupContextTruncatedNote: (maxKb) => `> [Unified Memory \u542F\u52A8\u6CE8\u5165\u4E0A\u4E0B\u6587\u5DF2\u6309 ${maxKb} KB \u9884\u7B97\u622A\u65AD]`,
  pendingExternalRuleNotice: (pendingCount) => `> [Unified Memory] \u5DF2\u62E6\u622A ${pendingCount} \u9879\u6307\u5411\u5DE5\u4F5C\u533A\u5916\u90E8\u4E14\u672A\u6388\u6743\u7684\u89C4\u5219 @import / \u7B26\u53F7\u94FE\u63A5\u3002\u8BF7\u6253\u5F00 Unified Memory \u63A7\u5236\u53F0\uFF08\u201C\u89C4\u5219\u4E0E\u4E0A\u4E0B\u6587\u201D\u6807\u7B7E\u9875\uFF09\u6216\u6267\u884C \`/memory trust\` \u5BA1\u67E5\u5E76\u6388\u6743\u3002`,
  hostDedupedImportOnlySubtitle: (displayPath) => `${displayPath}\uFF08\u4EC5 @import \u5C55\u5F00\u5185\u5BB9 \u2014\u2014 \u539F\u59CB\u6B63\u6587\u5DF2\u7531 DeepSeek Harness \u539F\u751F\u52A0\u8F7D\uFF09`,
  scopedRuleMatchedSubtitle: (displayPath, triggeredBy) => `${displayPath}\uFF08\u8DEF\u5F84\u6761\u4EF6\u89C4\u5219\uFF0C\u547D\u4E2D \`${triggeredBy}\`\uFF09`,
  subdirClaudeMdTriggeredSubtitle: (displayPath, triggeredBy) => `${displayPath}\uFF08\u5B50\u76EE\u5F55 CLAUDE.md\uFF0C\u7531 \`${triggeredBy}\` \u89E6\u53D1\uFF09`,
  memoryIndexExceededWarning: (totalLines, totalKb) => `MEMORY.md \u5DF2\u8D85\u51FA Claude Code \u7684 200 \u884C / 25 KB \u542F\u52A8\u4E0A\u9650\uFF08\u5F53\u524D ${totalLines} \u884C\uFF0C${totalKb} KB\uFF09\uFF0C\u5EFA\u8BAE\u6267\u884C\u8BB0\u5FC6\u6574\u7406\uFF08memory-dream\uFF09\u3002`,
  memoryIndexApproachingWarning: (totalLines, totalKb) => `MEMORY.md \u63A5\u8FD1 200 \u884C / 25 KB \u542F\u52A8\u4E0A\u9650\uFF08\u5F53\u524D ${totalLines}/200 \u884C\uFF0C${totalKb}/25 KB\uFF09\u3002`,
  autoMemoryDisabledError: "Claude \u81EA\u52A8\u8BB0\u5FC6\u5DF2\u5728\u914D\u7F6E\u4E2D\u5173\u95ED\u6216\u8BBE\u7F6E\u4E86 CLAUDE_CODE_DISABLE_AUTO_MEMORY\u3002",
  topicNotFoundError: (filename, memoryDir) => `\u672A\u5728 ${memoryDir} \u4E2D\u627E\u5230\u4E3B\u9898\u8BB0\u5FC6\u6587\u4EF6 "${filename}"`,
  externalTargetsApprovalNote: "\u6307\u5411\u5DE5\u4F5C\u533A\u5916\u90E8\u7684\u89C4\u5219\u76EE\u6807\u9700\u8981\u7528\u6237\u5728 Unified Memory \u63A7\u5236\u53F0\uFF08\u201C\u89C4\u5219\u4E0E\u4E0A\u4E0B\u6587\u201D\u6807\u7B7E\u9875\uFF09\u6216\u901A\u8FC7 `/memory trust` \u624B\u52A8\u6279\u51C6\u3002",
  cmdTitle: "Unified Memory \u8BB0\u5FC6\u72B6\u6001",
  cmdUsageHint: "\u7528\u6CD5\uFF1A/memory [status | list | rules | trust | reload]",
  cmdStatusLineLocale: (resolved, pref) => `\u5F53\u524D\u8BED\u8A00\uFF1A${resolved}\uFF08\u914D\u7F6E\uFF1A${pref}\uFF09`,
  cmdStatusLineWorkspace: (cwd, resolvedRoot, isWorktree) => `\u5F53\u524D\u5DE5\u4F5C\u533A\uFF1A${cwd}${isWorktree ? ` -> Git \u4E3B\u4ED3\u5E93\u6839\uFF1A${resolvedRoot}` : ""}`,
  cmdStatusLineClaude: (slug, memoryDir, enabled, exists) => `Claude \u81EA\u52A8\u8BB0\u5FC6\uFF1A${enabled ? exists ? "\u5DF2\u5C31\u7EEA" : "\u5C1A\u672A\u521D\u59CB\u5316" : "\u5DF2\u7981\u7528"} | slug=${slug} | \u76EE\u5F55=${memoryDir}`,
  cmdStatusLineIndex: (lines, maxLines, kb, truncated) => `MEMORY.md\uFF1A${lines}/${maxLines} \u884C\uFF0C${kb}/25.0 KB${truncated ? "\uFF08\u5DF2\u622A\u65AD\uFF09" : ""}`,
  cmdStatusLineTopics: (count) => `\u4E3B\u9898\u8BB0\u5FC6\u6570\uFF1A${count}`,
  cmdStatusLineCodex: (generation, codexHome) => `Codex \u8BB0\u5FC6\uFF08\u53EA\u8BFB\uFF09\uFF1A\u4EE3\u6B21=${generation} | \u76EE\u5F55=${codexHome}`,
  cmdStatusLineSession: (baselineInjected, compactionCount, hostDedupedCount, lazyRuleCount) => `\u5F53\u524D\u4F1A\u8BDD\uFF1A\u57FA\u7EBF=${baselineInjected ? "\u5DF2\u6CE8\u5165" : "\u5F85\u6CE8\u5165"} | \u538B\u5B9E\u91CD\u8F7D=${compactionCount} | \u5BBF\u4E3B\u53BB\u91CD=${hostDedupedCount} | \u61D2\u52A0\u8F7D\u89C4\u5219=${lazyRuleCount}`,
  cmdReloadNotice: "\u5DF2\u9884\u7EA6\u5728\u5F53\u524D\u4F1A\u8BDD\u7684\u4E0B\u4E00\u8F6E\u6A21\u578B\u6B65\u9AA4\u91CD\u65B0\u6CE8\u5165\u6700\u65B0\u57FA\u7EBF\u8BB0\u5FC6\u4E0E\u89C4\u5219\u3002",
  cmdNoTopics: "\u5F53\u524D\u5DE5\u4F5C\u533A\u5C1A\u65E0 Claude \u81EA\u52A8\u8BB0\u5FC6\u4E3B\u9898\u6587\u4EF6\u3002",
  cmdNoExternalPending: "\u5F53\u524D\u5DE5\u4F5C\u533A\u672A\u68C0\u6D4B\u5230\u5F85\u5BA1\u6279\u7684\u5916\u90E8\u89C4\u5219 @import \u6216\u7B26\u53F7\u94FE\u63A5\u3002"
};
var CORE_MESSAGES = {
  en: EN_MESSAGES,
  zh: ZH_MESSAGES
};

// src/core/i18n/index.ts
function normalizeLocale(raw) {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().split(".")[0]?.split("@")[0]?.trim().toLowerCase() ?? "";
  if (!cleaned || cleaned === "auto" || cleaned === "c" || cleaned === "posix") {
    return null;
  }
  if (cleaned === "zh" || cleaned.startsWith("zh-") || cleaned.startsWith("zh_")) {
    return "zh";
  }
  if (cleaned === "en" || cleaned.startsWith("en-") || cleaned.startsWith("en_")) {
    return "en";
  }
  return null;
}
function normalizeLocalePreference(raw) {
  if (typeof raw !== "string") return "auto";
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === "auto") return "auto";
  return normalizeLocale(trimmed) ?? "auto";
}
function resolveLocale(options) {
  const env = options?.env ?? process.env;
  const fromConfig = normalizeLocale(options?.configLocale);
  if (fromConfig) return fromConfig;
  const fromPluginEnv = normalizeLocale(env.UNIFIED_MEMORY_LOCALE);
  if (fromPluginEnv) return fromPluginEnv;
  const fromHost = normalizeLocale(options?.hostLocale);
  if (fromHost) return fromHost;
  for (const key of ["LC_ALL", "LC_MESSAGES", "LANG"]) {
    const val = normalizeLocale(env[key]);
    if (val) return val;
  }
  let runtimeLocale = options?.systemLocale;
  if (runtimeLocale === void 0) {
    try {
      runtimeLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      runtimeLocale = null;
    }
  }
  const fromSystem = normalizeLocale(runtimeLocale);
  if (fromSystem) return fromSystem;
  return "en";
}
function getMessages(locale) {
  return CORE_MESSAGES[locale] ?? CORE_MESSAGES.en;
}

// src/core/claude/frontmatter.ts
function unquoteYamlScalar(raw) {
  const trimmed = raw.trim();
  if (trimmed.length >= 2) {
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      }
    }
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1).replace(/''/g, "'");
    }
  }
  return trimmed;
}
function parseInlineArray(raw) {
  const inner = raw.trim().slice(1, -1).trim();
  if (!inner) return [];
  const items = [];
  let current = "";
  let quote = null;
  let escape = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (escape) {
      current += ch;
      escape = false;
      continue;
    }
    if (ch === "\\" && quote === '"') {
      current += ch;
      escape = true;
      continue;
    }
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ",") {
      if (current.trim()) items.push(unquoteYamlScalar(current));
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) items.push(unquoteYamlScalar(current));
  return items;
}
function parseFrontmatter(raw) {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n") && normalized !== "---") {
    return { hasFrontmatter: false, data: {}, body: normalized };
  }
  const lines = normalized.split("\n");
  let endIdx = -1;
  for (let i2 = 1; i2 < lines.length; i2++) {
    if (lines[i2].trim() === "---") {
      endIdx = i2;
      break;
    }
  }
  if (endIdx === -1) {
    return {
      hasFrontmatter: false,
      parseError: "Unclosed YAML frontmatter delimiter",
      data: {},
      body: normalized
    };
  }
  const fmLines = lines.slice(1, endIdx);
  const body = lines.slice(endIdx + 1).join("\n").replace(/^\n+/, "");
  const data = {};
  let i = 0;
  try {
    while (i < fmLines.length) {
      const line = fmLines[i];
      if (!line.trim() || line.trim().startsWith("#")) {
        i++;
        continue;
      }
      const match = /^([A-Za-z0-9_-]+)\s*:(.*)$/.exec(line);
      if (!match) {
        return {
          hasFrontmatter: true,
          parseError: `Invalid frontmatter line ${i + 2}: ${line}`,
          data: {},
          body
        };
      }
      const key = match[1];
      const rest = match[2].trim();
      if (rest === ">" || rest === ">-" || rest === "|" || rest === "|-") {
        const blockLines = [];
        let baseIndent = null;
        i++;
        while (i < fmLines.length) {
          const next = fmLines[i];
          if (next.trim() === "") {
            blockLines.push("");
            i++;
            continue;
          }
          const indent = next.length - next.trimStart().length;
          if (indent === 0) break;
          if (baseIndent === null) baseIndent = indent;
          blockLines.push(next.slice(Math.min(baseIndent, indent)));
          i++;
        }
        const joined = rest.startsWith(">") ? blockLines.join("\n").replace(/([^\n])\n([^\n])/g, "$1 $2").trim() : blockLines.join("\n").trimEnd();
        data[key] = joined;
        continue;
      }
      if (rest.startsWith("[") && rest.endsWith("]")) {
        data[key] = parseInlineArray(rest);
        i++;
        continue;
      }
      if (rest === "") {
        i++;
        const nestedLines = [];
        while (i < fmLines.length) {
          const next = fmLines[i];
          if (!next.trim() || next.trim().startsWith("#")) {
            i++;
            continue;
          }
          const indent = next.length - next.trimStart().length;
          if (indent === 0) break;
          nestedLines.push(next.trim());
          i++;
        }
        if (nestedLines.length === 0) {
          data[key] = "";
        } else if (nestedLines.every((l) => l.startsWith("-"))) {
          data[key] = nestedLines.map((l) => unquoteYamlScalar(l.slice(1).trim()));
        } else {
          const nestedMap = {};
          for (const nl of nestedLines) {
            const nm = /^([A-Za-z0-9_-]+)\s*:(.*)$/.exec(nl);
            if (nm) {
              nestedMap[nm[1]] = unquoteYamlScalar(nm[2]);
            }
          }
          data[key] = nestedMap;
        }
        continue;
      }
      data[key] = unquoteYamlScalar(rest);
      i++;
    }
  } catch (err) {
    return {
      hasFrontmatter: true,
      parseError: err instanceof Error ? err.message : String(err),
      data: {},
      body
    };
  }
  return { hasFrontmatter: true, data, body };
}
function extractTopicMetadata(parsed) {
  if (!parsed.hasFrontmatter || parsed.parseError) {
    return {
      schema: "none",
      extraTopLevel: {},
      extraMetadata: {}
    };
  }
  const d = parsed.data;
  const metaObj = d.metadata && typeof d.metadata === "object" && !Array.isArray(d.metadata) ? d.metadata : null;
  const schema = metaObj ? "nested_metadata" : "flat";
  const name2 = typeof d.name === "string" ? d.name : void 0;
  const description = typeof d.description === "string" ? d.description : void 0;
  const type = (metaObj && typeof metaObj.type === "string" ? metaObj.type : void 0) ?? (typeof d.type === "string" ? d.type : void 0);
  const nodeType = metaObj && typeof metaObj.node_type === "string" ? metaObj.node_type : void 0;
  const originSessionId = (metaObj && typeof metaObj.originSessionId === "string" ? metaObj.originSessionId : void 0) ?? (typeof d.originSessionId === "string" ? d.originSessionId : void 0);
  const modified = metaObj && typeof metaObj.modified === "string" ? metaObj.modified : void 0;
  const extraTopLevel = {};
  for (const [k, v] of Object.entries(d)) {
    if (!["name", "description", "type", "originSessionId", "metadata"].includes(k)) {
      extraTopLevel[k] = v;
    }
  }
  const extraMetadata = {};
  if (metaObj) {
    for (const [k, v] of Object.entries(metaObj)) {
      if (!["node_type", "type", "originSessionId", "modified"].includes(k)) {
        extraMetadata[k] = String(v);
      }
    }
  }
  return {
    name: name2,
    description,
    type,
    nodeType,
    originSessionId,
    modified,
    schema,
    extraTopLevel,
    extraMetadata
  };
}
function formatYamlScalar(value) {
  const singleLine = value.replace(/\r?\n/g, " ").trim();
  if (singleLine === "" || /[:#[\]{}&*!|>'"%@`,?]/.test(singleLine) || /^\s|\s$/.test(singleLine) || /^(true|false|null|~|-)$/i.test(singleLine)) {
    return JSON.stringify(singleLine);
  }
  return singleLine;
}
function serializeClaudeTopic(input) {
  const modified = input.modified ?? (/* @__PURE__ */ new Date()).toISOString();
  const lines = [
    "---",
    `name: ${formatYamlScalar(input.name)}`,
    `description: ${formatYamlScalar(input.description)}`
  ];
  if (input.extraTopLevel) {
    for (const [k, v] of Object.entries(input.extraTopLevel)) {
      if (typeof v === "string") {
        lines.push(`${k}: ${formatYamlScalar(v)}`);
      }
    }
  }
  lines.push("metadata:");
  lines.push("  node_type: memory");
  lines.push(`  type: ${formatYamlScalar(input.type)}`);
  if (input.originSessionId) {
    lines.push(`  originSessionId: ${formatYamlScalar(input.originSessionId)}`);
  }
  lines.push(`  modified: ${formatYamlScalar(modified)}`);
  if (input.extraMetadata) {
    for (const [k, v] of Object.entries(input.extraMetadata)) {
      lines.push(`  ${k}: ${formatYamlScalar(v)}`);
    }
  }
  lines.push("---");
  lines.push("");
  const cleanBody = input.body.replace(/\r\n/g, "\n").trim();
  if (cleanBody) {
    lines.push(cleanBody);
    lines.push("");
  }
  return lines.join("\n");
}

// src/core/claude/paths.ts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
function canonicalizeFsPath(filePath) {
  const expanded = expandHome(filePath.trim());
  const resolved = path.resolve(expanded);
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}
function resolveGitTopLevel(dirPath) {
  const normalized = path.resolve(dirPath);
  if (!fs.existsSync(normalized)) return null;
  let targetDir = normalized;
  try {
    if (fs.statSync(normalized).isFile()) {
      targetDir = path.dirname(normalized);
    }
  } catch {
    return null;
  }
  try {
    const topLevel = execFileSync("git", ["-C", targetDir, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      timeout: 1500,
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    if (!topLevel) return null;
    return canonicalizeFsPath(topLevel);
  } catch {
    return null;
  }
}
function getClaudeStateFilePath(claudeConfigDir = getClaudeConfigDir(), homeDir = os.homedir()) {
  const defaultConfigDir = path.join(homeDir, ".claude");
  if (path.resolve(claudeConfigDir) !== path.resolve(defaultConfigDir)) {
    return path.join(claudeConfigDir, ".claude.json");
  }
  return path.join(homeDir, ".claude.json");
}
function getClaudeConfigDir(env = process.env) {
  const configured = env.CLAUDE_CONFIG_DIR?.trim();
  if (configured) {
    return expandHome(configured);
  }
  return path.join(os.homedir(), ".claude");
}
function expandHome(filePath) {
  if (filePath === "~") return os.homedir();
  if (filePath.startsWith("~/") || filePath.startsWith("~\\")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}
function simpleHashBase36(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
function encodeClaudeProjectSlug(absPath) {
  const normalized = path.resolve(absPath);
  const sanitized = normalized.replace(/[^a-zA-Z0-9]/g, "-");
  if (sanitized.length <= 200) {
    return sanitized;
  }
  return `${sanitized.slice(0, 200)}-${simpleHashBase36(normalized)}`;
}
function resolveGitMainRoot(dirPath) {
  const normalized = path.resolve(dirPath);
  if (!fs.existsSync(normalized)) {
    return { root: normalized, isGitWorktree: false };
  }
  let targetDir = normalized;
  try {
    if (fs.statSync(normalized).isFile()) {
      targetDir = path.dirname(normalized);
    }
  } catch {
    return { root: normalized, isGitWorktree: false };
  }
  try {
    const topLevel = execFileSync("git", ["-C", targetDir, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      timeout: 1500,
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    const commonDirRaw = execFileSync(
      "git",
      ["-C", targetDir, "rev-parse", "--git-common-dir"],
      {
        encoding: "utf8",
        timeout: 1500,
        stdio: ["ignore", "pipe", "ignore"]
      }
    ).trim();
    const gitDirRaw = execFileSync("git", ["-C", targetDir, "rev-parse", "--git-dir"], {
      encoding: "utf8",
      timeout: 1500,
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    const canonical = (p) => {
      try {
        return fs.realpathSync(p);
      } catch {
        return path.resolve(p);
      }
    };
    const resolvedTop = canonical(topLevel);
    const resolvedCommon = canonical(
      path.isAbsolute(commonDirRaw) ? commonDirRaw : path.resolve(targetDir, commonDirRaw)
    );
    const resolvedGitDir = canonical(
      path.isAbsolute(gitDirRaw) ? gitDirRaw : path.resolve(targetDir, gitDirRaw)
    );
    const isGitWorktree = resolvedCommon !== resolvedGitDir;
    if (path.basename(resolvedCommon) === ".git") {
      return {
        root: path.dirname(resolvedCommon),
        gitCommonDir: resolvedCommon,
        isGitWorktree
      };
    }
    return {
      root: resolvedTop,
      gitCommonDir: resolvedCommon,
      isGitWorktree
    };
  } catch {
    return { root: targetDir, isGitWorktree: false };
  }
}
function safeReadJsonObject(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
function readClaudeSettings(projectRoot, claudeConfigDir = getClaudeConfigDir(), env = process.env) {
  const files = [
    path.join(claudeConfigDir, "settings.json"),
    path.join(claudeConfigDir, "settings.local.json")
  ];
  if (projectRoot) {
    files.push(
      path.join(projectRoot, ".claude", "settings.json"),
      path.join(projectRoot, ".claude", "settings.local.json")
    );
  }
  let autoMemoryEnabled = true;
  let autoMemoryDirectory;
  const excludeSet = /* @__PURE__ */ new Set();
  for (const file of files) {
    const obj = safeReadJsonObject(file);
    if (!obj) continue;
    if (typeof obj.autoMemoryEnabled === "boolean") {
      autoMemoryEnabled = obj.autoMemoryEnabled;
    }
    if (typeof obj.autoMemoryDirectory === "string" && obj.autoMemoryDirectory.trim()) {
      autoMemoryDirectory = expandHome(obj.autoMemoryDirectory.trim());
    }
    if (Array.isArray(obj.claudeMdExcludes)) {
      for (const item of obj.claudeMdExcludes) {
        if (typeof item === "string" && item.trim()) {
          excludeSet.add(item.trim());
        }
      }
    }
  }
  const disabledEnvRaw = (env.CLAUDE_CODE_DISABLE_AUTO_MEMORY ?? "").trim().toLowerCase();
  const disabledByEnv = disabledEnvRaw === "1" || disabledEnvRaw === "true";
  return {
    autoMemoryEnabled: disabledByEnv ? false : autoMemoryEnabled,
    autoMemoryDirectory,
    claudeMdExcludes: Array.from(excludeSet),
    disabledByEnv
  };
}
function resolveClaudeProject(inputPath, options) {
  const claudeConfigDir = options?.claudeConfigDir ?? getClaudeConfigDir(options?.env);
  const env = options?.env ?? process.env;
  const gitInfo = resolveGitMainRoot(inputPath);
  const settings = readClaudeSettings(gitInfo.root, claudeConfigDir, env);
  const slug = encodeClaudeProjectSlug(gitInfo.root);
  const memoryDir = settings.autoMemoryDirectory ? settings.autoMemoryDirectory : path.join(claudeConfigDir, "projects", slug, "memory");
  return {
    inputPath: path.resolve(inputPath),
    resolvedRoot: gitInfo.root,
    gitCommonDir: gitInfo.gitCommonDir,
    isGitWorktree: gitInfo.isGitWorktree,
    slug,
    memoryDir,
    autoMemoryEnabled: settings.autoMemoryEnabled,
    autoMemoryOverride: settings.autoMemoryDirectory,
    disabledByEnv: settings.disabledByEnv,
    exists: fs.existsSync(memoryDir)
  };
}
function readClaudeCodeExternalApproval(workspaceRoot, options) {
  const homeDir = options?.homeDir ?? os.homedir();
  const claudeConfigDir = options?.claudeConfigDir ?? getClaudeConfigDir();
  const statePath = options?.claudeStateFilePath ?? getClaudeStateFilePath(claudeConfigDir, homeDir);
  const obj = safeReadJsonObject(statePath);
  if (!obj || !obj.projects || typeof obj.projects !== "object" || Array.isArray(obj.projects)) {
    return null;
  }
  const projects = obj.projects;
  const resolvedWs = path.resolve(workspaceRoot);
  const realWs = canonicalizeFsPath(workspaceRoot);
  const extractState = (projKey, entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const rec = entry;
    const hasApproved = typeof rec.hasClaudeMdExternalIncludesApproved === "boolean";
    const hasWarning = typeof rec.hasClaudeMdExternalIncludesWarningShown === "boolean";
    if (!hasApproved && !hasWarning) return null;
    return {
      approved: rec.hasClaudeMdExternalIncludesApproved === true,
      warningShown: rec.hasClaudeMdExternalIncludesWarningShown === true,
      matchedProjectKey: projKey
    };
  };
  for (const key of [resolvedWs, realWs]) {
    if (Object.prototype.hasOwnProperty.call(projects, key)) {
      const state = extractState(key, projects[key]);
      if (state) return state;
    }
  }
  for (const [projKey, val] of Object.entries(projects)) {
    if (!projKey.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(projKey)) continue;
    const normKey = path.resolve(projKey);
    if (normKey === resolvedWs || normKey === realWs || canonicalizeFsPath(normKey) === realWs) {
      const state = extractState(projKey, val);
      if (state) return state;
    }
  }
  return null;
}
function buildKnownProjectPathMap(homeDir = os.homedir()) {
  const map = /* @__PURE__ */ new Map();
  const claudeJsonPath = path.join(homeDir, ".claude.json");
  const obj = safeReadJsonObject(claudeJsonPath);
  if (obj && obj.projects && typeof obj.projects === "object" && !Array.isArray(obj.projects)) {
    for (const projPath of Object.keys(obj.projects)) {
      if (projPath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(projPath)) {
        map.set(encodeClaudeProjectSlug(projPath), projPath);
      }
    }
  }
  return map;
}
function discoverAllClaudeProjects(claudeConfigDir = getClaudeConfigDir(), homeDir = os.homedir()) {
  const projectsRoot = path.join(claudeConfigDir, "projects");
  if (!fs.existsSync(projectsRoot)) return [];
  const pathMap = buildKnownProjectPathMap(homeDir);
  const entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const memoryDir = path.join(projectsRoot, slug, "memory");
    const hasMemoryDir = fs.existsSync(memoryDir);
    const indexPath = path.join(memoryDir, "MEMORY.md");
    const hasMemoryIndex = hasMemoryDir && fs.existsSync(indexPath);
    let indexLines = 0;
    let indexBytes = 0;
    let topicCount = 0;
    let lastModifiedMs = 0;
    if (hasMemoryIndex) {
      try {
        const st = fs.statSync(indexPath);
        indexBytes = st.size;
        lastModifiedMs = Math.max(lastModifiedMs, st.mtimeMs);
        const content = fs.readFileSync(indexPath, "utf8");
        indexLines = content === "" ? 0 : content.replace(/\r\n/g, "\n").split("\n").length;
      } catch {
      }
    }
    if (hasMemoryDir) {
      try {
        const memEntries = fs.readdirSync(memoryDir, { withFileTypes: true });
        for (const mf of memEntries) {
          if (!mf.isFile() || !mf.name.endsWith(".md") || mf.name === "MEMORY.md") continue;
          topicCount++;
          try {
            const st = fs.statSync(path.join(memoryDir, mf.name));
            lastModifiedMs = Math.max(lastModifiedMs, st.mtimeMs);
          } catch {
          }
        }
      } catch {
      }
    }
    const mapped = pathMap.get(slug);
    results.push({
      slug,
      displayPath: mapped ?? slug,
      exactPathResolved: Boolean(mapped),
      memoryDir,
      hasMemoryDir,
      hasMemoryIndex,
      indexLines,
      indexBytes,
      topicCount,
      lastModifiedMs
    });
  }
  results.sort((a, b) => b.lastModifiedMs - a.lastModifiedMs || a.slug.localeCompare(b.slug));
  return results;
}

// src/core/claude/memory.ts
import fs2 from "node:fs";
import path2 from "node:path";
var MAX_MEMORY_INDEX_LINES = 200;
var MAX_MEMORY_INDEX_BYTES = 25 * 1024;
var LOCK_STALE_MS = 15e3;
var LOCK_TIMEOUT_MS = 2500;
function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
  }
}
function withFileLock(lockDir, fn) {
  fs2.mkdirSync(lockDir, { recursive: true });
  const lockFile = path2.join(lockDir, ".unified-memory.lock");
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (true) {
    try {
      const fd = fs2.openSync(lockFile, "wx");
      try {
        fs2.writeSync(fd, `${process.pid}:${Date.now()}
`);
      } finally {
        fs2.closeSync(fd);
      }
      break;
    } catch (err) {
      const code = err?.code;
      if (code !== "EEXIST") throw err;
      try {
        const st = fs2.statSync(lockFile);
        if (Date.now() - st.mtimeMs > LOCK_STALE_MS) {
          fs2.unlinkSync(lockFile);
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for memory lock at ${lockFile}`);
      }
      sleepSync(15);
    }
  }
  try {
    return fn();
  } finally {
    try {
      fs2.unlinkSync(lockFile);
    } catch {
    }
  }
}
function atomicWriteFile(filePath, content) {
  const dir = path2.dirname(filePath);
  fs2.mkdirSync(dir, { recursive: true });
  const tmpPath = path2.join(
    dir,
    `.${path2.basename(filePath)}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`
  );
  fs2.writeFileSync(tmpPath, content, "utf8");
  fs2.renameSync(tmpPath, filePath);
}
function sanitizeTopicFilename(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Topic filename or name must not be empty");
  }
  const base = path2.basename(trimmed);
  if (base !== trimmed || base.includes("..") || base.includes("/") || base.includes("\\")) {
    throw new Error(`Invalid topic filename (path traversal not allowed): ${input}`);
  }
  const withoutExt = base.replace(/\.md$/i, "").trim();
  const slug = withoutExt.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (slug === "memory") {
    throw new Error(`Invalid or reserved topic filename: ${input}`);
  }
  if (!slug) {
    if (/[\p{L}\p{N}]/u.test(withoutExt)) {
      return `topic-${simpleHashBase36(withoutExt)}.md`;
    }
    throw new Error(`Invalid or reserved topic filename: ${input}`);
  }
  return `${slug}.md`;
}
function assertNoSymlinkEscape(memoryDir, targetPath, filename) {
  let lstat = null;
  try {
    lstat = fs2.lstatSync(targetPath);
  } catch {
    return;
  }
  let realDir;
  try {
    realDir = fs2.realpathSync(memoryDir);
  } catch {
    realDir = path2.resolve(memoryDir);
  }
  if (lstat.isSymbolicLink()) {
    let realTarget;
    try {
      realTarget = fs2.realpathSync(targetPath);
    } catch {
      const rawLink = fs2.readlinkSync(targetPath);
      const resolvedLink = path2.resolve(path2.dirname(targetPath), rawLink);
      if (path2.dirname(resolvedLink) !== realDir && path2.dirname(resolvedLink) !== path2.resolve(memoryDir)) {
        throw new Error(`Symlink escapes memory directory: ${filename}`);
      }
      return;
    }
    if (path2.dirname(realTarget) !== realDir) {
      throw new Error(`Symlink escapes memory directory: ${filename}`);
    }
  }
}
function assertInsideMemoryDir(memoryDir, filename) {
  const base = path2.basename(filename);
  if (base !== filename || base.includes("..") || !base.endsWith(".md")) {
    throw new Error(`Unsafe memory filename: ${filename}`);
  }
  const resolvedDir = path2.resolve(memoryDir);
  const target = path2.resolve(resolvedDir, base);
  if (path2.dirname(target) !== resolvedDir) {
    throw new Error(`Path escapes memory directory: ${filename}`);
  }
  assertNoSymlinkEscape(resolvedDir, target, filename);
  return target;
}
function truncateMemoryIndex(content, maxLines = MAX_MEMORY_INDEX_LINES, maxBytes = MAX_MEMORY_INDEX_BYTES) {
  const normalized = content.replace(/\r\n/g, "\n");
  const totalBytes = Buffer.byteLength(normalized, "utf8");
  if (normalized === "") {
    return {
      truncatedContent: "",
      totalLines: 0,
      totalBytes: 0,
      includedLines: 0,
      includedBytes: 0,
      truncated: false
    };
  }
  const lines = normalized.split("\n");
  const totalLines = lines.length;
  const out = [];
  let bytes = 0;
  let truncated = false;
  for (let i = 0; i < lines.length; i++) {
    if (i >= maxLines) {
      truncated = true;
      break;
    }
    const line = lines[i];
    const sepBytes = i > 0 ? 1 : 0;
    const lineBytes = Buffer.byteLength(line, "utf8") + sepBytes;
    if (bytes + lineBytes > maxBytes) {
      truncated = true;
      break;
    }
    out.push(line);
    bytes += lineBytes;
  }
  return {
    truncatedContent: out.join("\n"),
    totalLines,
    totalBytes,
    includedLines: out.length,
    includedBytes: bytes,
    truncated
  };
}
function readMemoryIndex(memoryDir) {
  const filePath = assertInsideMemoryDir(memoryDir, "MEMORY.md");
  if (!fs2.existsSync(filePath)) {
    return {
      filePath,
      exists: false,
      content: "",
      truncatedContent: "",
      totalLines: 0,
      totalBytes: 0,
      includedLines: 0,
      includedBytes: 0,
      truncated: false,
      maxLines: MAX_MEMORY_INDEX_LINES,
      maxBytes: MAX_MEMORY_INDEX_BYTES,
      mtimeMs: 0
    };
  }
  const st = fs2.statSync(filePath);
  const content = fs2.readFileSync(filePath, "utf8");
  const trunc = truncateMemoryIndex(content);
  return {
    filePath,
    exists: true,
    content,
    ...trunc,
    maxLines: MAX_MEMORY_INDEX_LINES,
    maxBytes: MAX_MEMORY_INDEX_BYTES,
    mtimeMs: st.mtimeMs
  };
}
function readTopicMemory(memoryDir, filename) {
  const filePath = assertInsideMemoryDir(memoryDir, filename);
  if (!fs2.existsSync(filePath)) return null;
  const st = fs2.statSync(filePath);
  const rawContent = fs2.readFileSync(filePath, "utf8");
  const parsed = parseFrontmatter(rawContent);
  const meta = extractTopicMetadata(parsed);
  const fallbackName = path2.basename(filename, ".md");
  const lineCount = rawContent === "" ? 0 : rawContent.replace(/\r\n/g, "\n").split("\n").length;
  return {
    filename: path2.basename(filePath),
    filePath,
    name: meta.name ?? fallbackName,
    description: meta.description ?? "",
    type: meta.type ?? "project",
    nodeType: meta.nodeType,
    originSessionId: meta.originSessionId,
    modified: meta.modified,
    schema: meta.schema,
    body: parsed.body,
    rawContent,
    sizeBytes: st.size,
    lineCount,
    mtimeMs: st.mtimeMs
  };
}
function listTopicMemories(memoryDir) {
  if (!fs2.existsSync(memoryDir)) return [];
  const entries = fs2.readdirSync(memoryDir, { withFileTypes: true });
  const topics = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "MEMORY.md") {
      continue;
    }
    const topic = readTopicMemory(memoryDir, entry.name);
    if (topic) topics.push(topic);
  }
  topics.sort((a, b) => b.mtimeMs - a.mtimeMs || a.filename.localeCompare(b.filename));
  return topics;
}
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function buildIndexLine(name2, filename, description) {
  const cleanTitle = name2.replace(/[\r\n[\]]+/g, " ").trim() || filename;
  const cleanDesc = description.replace(/[\r\n]+/g, " ").trim();
  const clipped = cleanDesc.length > 150 ? `${cleanDesc.slice(0, 147)}...` : cleanDesc;
  return clipped ? `- [${cleanTitle}](${filename}) \u2014 ${clipped}` : `- [${cleanTitle}](${filename})`;
}
function upsertIndexEntry(existingContent, filename, indexLine) {
  const normalized = existingContent.replace(/\r\n/g, "\n");
  if (!normalized.trim()) {
    return `# Memory Index

${indexLine}
`;
  }
  const lines = normalized.split("\n");
  const linkPattern = new RegExp(`\\(\\.?/?${escapeRegExp(filename)}\\)`);
  let replaced = false;
  for (let i = 0; i < lines.length; i++) {
    if (linkPattern.test(lines[i])) {
      lines[i] = indexLine;
      replaced = true;
      break;
    }
  }
  if (!replaced) {
    let insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === "") {
      insertAt--;
    }
    while (insertAt > 0 && /^\[[^\]]+\]:\s+\S+/.test(lines[insertAt - 1].trim())) {
      insertAt--;
    }
    while (insertAt > 0 && lines[insertAt - 1].trim() === "") {
      insertAt--;
    }
    lines.splice(insertAt, 0, indexLine);
  }
  return `${lines.join("\n").replace(/\n*$/, "\n")}`;
}
function removeIndexEntry(existingContent, filename) {
  const normalized = existingContent.replace(/\r\n/g, "\n");
  if (!normalized) return "";
  const linkPattern = new RegExp(`\\(\\.?/?${escapeRegExp(filename)}\\)`);
  const kept = normalized.split("\n").filter((line) => !linkPattern.test(line));
  return `${kept.join("\n").replace(/\n*$/, "\n")}`;
}
function saveTopicMemory(memoryDir, input) {
  if (!CLAUDE_MEMORY_TYPES.includes(input.type)) {
    throw new Error(
      `Invalid Claude memory type "${String(input.type)}". Must be one of: ${CLAUDE_MEMORY_TYPES.join(", ")}`
    );
  }
  const filename = sanitizeTopicFilename(input.filename || input.name);
  const msg = getMessages(input.locale ?? "en");
  return withFileLock(memoryDir, () => {
    const filePath = assertInsideMemoryDir(memoryDir, filename);
    let extraTopLevel = {};
    let extraMetadata = {};
    let preservedOriginSessionId = input.originSessionId;
    if (fs2.existsSync(filePath)) {
      const existingRaw = fs2.readFileSync(filePath, "utf8");
      const parsed = parseFrontmatter(existingRaw);
      const existingMeta = extractTopicMetadata(parsed);
      extraTopLevel = existingMeta.extraTopLevel;
      extraMetadata = existingMeta.extraMetadata;
      if (!preservedOriginSessionId && existingMeta.originSessionId) {
        preservedOriginSessionId = existingMeta.originSessionId;
      }
    }
    const serialized = serializeClaudeTopic({
      name: input.name.trim(),
      description: input.description.trim(),
      type: input.type,
      originSessionId: preservedOriginSessionId,
      modified: (/* @__PURE__ */ new Date()).toISOString(),
      body: input.body,
      extraTopLevel,
      extraMetadata
    });
    atomicWriteFile(filePath, serialized);
    const indexPath = assertInsideMemoryDir(memoryDir, "MEMORY.md");
    const existingIndex = fs2.existsSync(indexPath) ? fs2.readFileSync(indexPath, "utf8") : "";
    const line = buildIndexLine(input.name, filename, input.description);
    const updatedIndexContent = upsertIndexEntry(existingIndex, filename, line);
    atomicWriteFile(indexPath, updatedIndexContent);
    const topic = readTopicMemory(memoryDir, filename);
    const index = readMemoryIndex(memoryDir);
    const warnings = [];
    const totalKb = (index.totalBytes / 1024).toFixed(1);
    if (index.truncated) {
      warnings.push(msg.memoryIndexExceededWarning(index.totalLines, totalKb));
    } else if (index.totalLines >= 175 || index.totalBytes >= 22 * 1024) {
      warnings.push(msg.memoryIndexApproachingWarning(index.totalLines, totalKb));
    }
    return { topic, index, warnings };
  });
}
function deleteTopicMemory(memoryDir, filename) {
  return withFileLock(memoryDir, () => {
    const filePath = assertInsideMemoryDir(memoryDir, filename);
    let deleted = false;
    if (fs2.existsSync(filePath)) {
      fs2.unlinkSync(filePath);
      deleted = true;
    }
    const indexPath = assertInsideMemoryDir(memoryDir, "MEMORY.md");
    if (fs2.existsSync(indexPath)) {
      const existingIndex = fs2.readFileSync(indexPath, "utf8");
      const updated = removeIndexEntry(existingIndex, path2.basename(filePath));
      if (updated !== existingIndex) {
        atomicWriteFile(indexPath, updated);
      }
    }
    return { deleted, index: readMemoryIndex(memoryDir) };
  });
}
function writeMemoryIndexRaw(memoryDir, content) {
  return withFileLock(memoryDir, () => {
    const indexPath = assertInsideMemoryDir(memoryDir, "MEMORY.md");
    atomicWriteFile(indexPath, content.replace(/\r\n/g, "\n"));
    return readMemoryIndex(memoryDir);
  });
}

// src/core/claude/rules.ts
import fs4 from "node:fs";
import os3 from "node:os";
import path4 from "node:path";

// src/core/session/state.ts
import fs3 from "node:fs";
import os2 from "node:os";
import path3 from "node:path";
var MAX_DIAGNOSTIC_LINES = 300;
var STALE_SESSION_MS = 7 * 24 * 60 * 60 * 1e3;
function resolvePluginDataDir(env = process.env, explicitDataDir) {
  const dshHome = env.DSH_HOME?.trim() ? expandHome(env.DSH_HOME.trim()) : path3.join(os2.homedir(), ".dsh");
  const preferred = explicitDataDir?.trim() || (env.UNIFIED_MEMORY_DATA_DIR?.trim() ? expandHome(env.UNIFIED_MEMORY_DATA_DIR.trim()) : "") || (env.PLUGIN_DATA?.trim() ? expandHome(env.PLUGIN_DATA.trim()) : "") || path3.join(dshHome, "storages", "unified-memory");
  try {
    fs3.mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch {
    const fallback = path3.join(os2.tmpdir(), "unified-memory-dsh");
    fs3.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}
function sanitizePathArray(input) {
  if (!Array.isArray(input)) return [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const item of input) {
    if (typeof item !== "string" || !item.trim()) continue;
    const cleaned = item.trim();
    if (!seen.has(cleaned)) {
      seen.add(cleaned);
      out.push(cleaned);
    }
  }
  return out;
}
function sanitizeExternalRuleTrust(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const result = {};
  for (const [rawKey, rawVal] of Object.entries(input)) {
    if (!rawKey.trim() || !rawVal || typeof rawVal !== "object" || Array.isArray(rawVal)) {
      continue;
    }
    const rec = rawVal;
    const allowPaths = sanitizePathArray(rec.allowPaths);
    const denyPaths = sanitizePathArray(rec.denyPaths);
    if (allowPaths.length > 0 || denyPaths.length > 0) {
      result[rawKey.trim()] = { allowPaths, denyPaths };
    }
  }
  return result;
}
function loadPluginConfig(dataDir = resolvePluginDataDir()) {
  const cfgPath = path3.join(dataDir, "config.json");
  if (!fs3.existsSync(cfgPath)) {
    return { ...DEFAULT_CONFIG, externalRuleTrust: {} };
  }
  try {
    const raw = JSON.parse(fs3.readFileSync(cfgPath, "utf8"));
    return {
      locale: normalizeLocalePreference(raw.locale),
      injectCodexSummaryOnStart: typeof raw.injectCodexSummaryOnStart === "boolean" ? raw.injectCodexSummaryOnStart : DEFAULT_CONFIG.injectCodexSummaryOnStart,
      codexSummaryMaxBytes: typeof raw.codexSummaryMaxBytes === "number" && raw.codexSummaryMaxBytes >= 512 ? raw.codexSummaryMaxBytes : DEFAULT_CONFIG.codexSummaryMaxBytes,
      injectCodexGlobalAgentsMd: typeof raw.injectCodexGlobalAgentsMd === "boolean" ? raw.injectCodexGlobalAgentsMd : DEFAULT_CONFIG.injectCodexGlobalAgentsMd,
      deduplicateNativeAgentsMd: typeof raw.deduplicateNativeAgentsMd === "boolean" ? raw.deduplicateNativeAgentsMd : DEFAULT_CONFIG.deduplicateNativeAgentsMd,
      maxStartupInjectBytes: typeof raw.maxStartupInjectBytes === "number" && raw.maxStartupInjectBytes >= 4096 ? raw.maxStartupInjectBytes : DEFAULT_CONFIG.maxStartupInjectBytes,
      trustClaudeCodeExternalApprovals: typeof raw.trustClaudeCodeExternalApprovals === "boolean" ? raw.trustClaudeCodeExternalApprovals : DEFAULT_CONFIG.trustClaudeCodeExternalApprovals,
      externalRuleTrust: sanitizeExternalRuleTrust(raw.externalRuleTrust)
    };
  } catch {
    return { ...DEFAULT_CONFIG, externalRuleTrust: {} };
  }
}
function savePluginConfig(patch, dataDir = resolvePluginDataDir()) {
  const current = loadPluginConfig(dataDir);
  const next = {
    ...current,
    ...patch,
    locale: patch.locale !== void 0 ? normalizeLocalePreference(patch.locale) : current.locale,
    externalRuleTrust: patch.externalRuleTrust !== void 0 ? sanitizeExternalRuleTrust(patch.externalRuleTrust) : current.externalRuleTrust
  };
  atomicWriteFile(path3.join(dataDir, "config.json"), JSON.stringify(next, null, 2) + "\n");
  return next;
}
function getWorkspaceExternalTrust(externalRuleTrust, workspaceRoot) {
  if (!externalRuleTrust) return { allowPaths: [], denyPaths: [] };
  const resolvedWs = path3.resolve(workspaceRoot);
  const realWs = canonicalizeFsPath(workspaceRoot);
  const allowSet = /* @__PURE__ */ new Set();
  const denySet = /* @__PURE__ */ new Set();
  for (const [key, entry] of Object.entries(externalRuleTrust)) {
    const normKey = path3.resolve(key);
    if (normKey === resolvedWs || normKey === realWs || canonicalizeFsPath(normKey) === realWs) {
      for (const p of entry.allowPaths) allowSet.add(canonicalizeFsPath(p));
      for (const p of entry.denyPaths) denySet.add(canonicalizeFsPath(p));
    }
  }
  return {
    allowPaths: Array.from(allowSet).sort(),
    denyPaths: Array.from(denySet).sort()
  };
}
function updateWorkspaceExternalTrust(workspaceRoot, action, targetPath, dataDir = resolvePluginDataDir()) {
  const config = loadPluginConfig(dataDir);
  const wsKey = canonicalizeFsPath(workspaceRoot);
  const resolvedWs = path3.resolve(workspaceRoot);
  const existing = getWorkspaceExternalTrust(config.externalRuleTrust, workspaceRoot);
  const nextMap = {};
  for (const [k, v] of Object.entries(config.externalRuleTrust)) {
    const nk = path3.resolve(k);
    if (nk === resolvedWs || nk === wsKey || canonicalizeFsPath(nk) === wsKey) continue;
    nextMap[k] = v;
  }
  if (action === "clear_workspace") {
    const saved2 = savePluginConfig({ externalRuleTrust: nextMap }, dataDir);
    return { config: saved2, workspaceKey: wsKey, trust: { allowPaths: [], denyPaths: [] } };
  }
  if (!targetPath || !targetPath.trim()) {
    throw new Error(`targetPath is required for action "${action}"`);
  }
  const canonicalTarget = canonicalizeFsPath(targetPath);
  const allowSet = new Set(existing.allowPaths);
  const denySet = new Set(existing.denyPaths);
  if (action === "allow") {
    allowSet.add(canonicalTarget);
    denySet.delete(canonicalTarget);
  } else if (action === "deny") {
    denySet.add(canonicalTarget);
    allowSet.delete(canonicalTarget);
  } else if (action === "revoke") {
    allowSet.delete(canonicalTarget);
    denySet.delete(canonicalTarget);
  }
  const nextTrust = {
    allowPaths: Array.from(allowSet).sort(),
    denyPaths: Array.from(denySet).sort()
  };
  if (nextTrust.allowPaths.length > 0 || nextTrust.denyPaths.length > 0) {
    nextMap[wsKey] = nextTrust;
  }
  const saved = savePluginConfig({ externalRuleTrust: nextMap }, dataDir);
  return { config: saved, workspaceKey: wsKey, trust: nextTrust };
}
function safeConversationKey(conversationId) {
  return String(conversationId || "unknown").replace(/[^a-zA-Z0-9._-]/g, "_");
}
function sessionsDir(dataDir) {
  const dir = path3.join(dataDir, "sessions");
  fs3.mkdirSync(dir, { recursive: true });
  return dir;
}
function createEmptySessionState(conversationId, workspacePaths = []) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    conversationId,
    sessionStarted: false,
    startedAt: now,
    workspacePaths,
    loadedRuleKeys: [],
    loadedSubdirPaths: [],
    indexedConditionalRules: [],
    pendingInjections: [],
    fileMtimes: {},
    lastInitialNumSteps: 0,
    transcriptByteOffset: 0,
    compactionCount: 0,
    updatedAt: now
  };
}
function loadSessionState(conversationId, dataDir = resolvePluginDataDir()) {
  const filePath = path3.join(sessionsDir(dataDir), `${safeConversationKey(conversationId)}.json`);
  if (!fs3.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs3.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}
function saveSessionState(state, dataDir = resolvePluginDataDir()) {
  state.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const filePath = path3.join(
    sessionsDir(dataDir),
    `${safeConversationKey(state.conversationId)}.json`
  );
  atomicWriteFile(filePath, JSON.stringify(state, null, 2) + "\n");
}
function listRecentSessions(dataDir = resolvePluginDataDir(), limit = 20) {
  const dir = sessionsDir(dataDir);
  const results = [];
  try {
    for (const e of fs3.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      try {
        results.push(JSON.parse(fs3.readFileSync(path3.join(dir, e.name), "utf8")));
      } catch {
      }
    }
  } catch {
    return [];
  }
  results.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return results.slice(0, limit);
}
function gcStaleSessions(dataDir = resolvePluginDataDir()) {
  const dir = sessionsDir(dataDir);
  const cutoff = Date.now() - STALE_SESSION_MS;
  try {
    for (const e of fs3.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      const full = path3.join(dir, e.name);
      try {
        if (fs3.statSync(full).mtimeMs < cutoff) {
          fs3.unlinkSync(full);
        }
      } catch {
      }
    }
  } catch {
  }
}
function appendDiagnosticEvent(event, dataDir = resolvePluginDataDir()) {
  const logPath = path3.join(dataDir, "diagnostics.jsonl");
  try {
    fs3.appendFileSync(logPath, JSON.stringify(event) + "\n", "utf8");
    const st = fs3.statSync(logPath);
    if (st.size > 400 * 1024) {
      const lines = fs3.readFileSync(logPath, "utf8").split("\n").filter((l) => l.trim().length > 0);
      const trimmed = lines.slice(-MAX_DIAGNOSTIC_LINES).join("\n") + "\n";
      atomicWriteFile(logPath, trimmed);
    }
  } catch {
  }
}
function readDiagnosticEvents(dataDir = resolvePluginDataDir(), limit = 100) {
  const logPath = path3.join(dataDir, "diagnostics.jsonl");
  if (!fs3.existsSync(logPath)) return [];
  try {
    const lines = fs3.readFileSync(logPath, "utf8").split("\n").filter((l) => l.trim().length > 0);
    const slice = lines.slice(-limit).reverse();
    const events = [];
    for (const line of slice) {
      try {
        events.push(JSON.parse(line));
      } catch {
      }
    }
    return events;
  } catch {
    return [];
  }
}
function clearDiagnosticEvents(dataDir = resolvePluginDataDir()) {
  const logPath = path3.join(dataDir, "diagnostics.jsonl");
  if (fs3.existsSync(logPath)) {
    atomicWriteFile(logPath, "");
  }
}

// src/core/claude/rules.ts
var MAX_IMPORT_DEPTH = 5;
var DEFAULT_NATIVE_RULE_FILENAMES = [
  "AGENTS.md",
  "AGENTS.local.md"
];
var DEFAULT_HOST_NAME = "DeepSeek Harness";
function expandBraceGlob(pattern) {
  const match = /\{([^{}]+)\}/.exec(pattern);
  if (!match) return [pattern];
  const prefix = pattern.slice(0, match.index);
  const suffix = pattern.slice(match.index + match[0].length);
  const options = match[1].split(",");
  const results = [];
  for (const opt of options) {
    for (const expanded of expandBraceGlob(`${prefix}${opt}${suffix}`)) {
      results.push(expanded);
    }
  }
  return results;
}
function globToRegExp(glob) {
  const normalized = glob.replace(/\\/g, "/").replace(/^\.\//, "");
  let rx = "^";
  let i = 0;
  while (i < normalized.length) {
    const ch = normalized[i];
    if (ch === "*") {
      if (normalized[i + 1] === "*") {
        if (normalized[i + 2] === "/") {
          rx += "(?:.*/)?";
          i += 3;
          continue;
        }
        rx += ".*";
        i += 2;
        continue;
      }
      rx += "[^/]*";
      i++;
      continue;
    }
    if (ch === "?") {
      rx += "[^/]";
      i++;
      continue;
    }
    if ("^$.|+()[]{}".includes(ch)) {
      rx += `\\${ch}`;
    } else {
      rx += ch;
    }
    i++;
  }
  rx += "$";
  return new RegExp(rx);
}
function matchesGlobPatterns(targetPath, patterns) {
  const normTarget = targetPath.replace(/\\/g, "/").replace(/^\.\//, "");
  for (const rawPattern of patterns) {
    const trimmed = rawPattern.trim();
    if (!trimmed) continue;
    for (const expanded of expandBraceGlob(trimmed)) {
      const re = globToRegExp(expanded);
      if (re.test(normTarget)) return true;
      if (!expanded.includes("/") && re.test(path4.posix.basename(normTarget))) {
        return true;
      }
    }
  }
  return false;
}
function stripHtmlComments(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let inFence = false;
  let fenceChar = "";
  let inHtmlComment = false;
  for (const line of lines) {
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
    if (!inHtmlComment && fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceChar = fenceMatch[1][0];
      } else if (fenceMatch[1][0] === fenceChar) {
        inFence = false;
        fenceChar = "";
      }
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    let result = "";
    let i = 0;
    let inInlineCode = false;
    while (i < line.length) {
      if (inHtmlComment) {
        const endIdx = line.indexOf("-->", i);
        if (endIdx === -1) {
          i = line.length;
        } else {
          inHtmlComment = false;
          i = endIdx + 3;
        }
        continue;
      }
      if (line[i] === "`") {
        inInlineCode = !inInlineCode;
        result += line[i];
        i++;
        continue;
      }
      if (!inInlineCode && line.startsWith("<!--", i)) {
        const endIdx = line.indexOf("-->", i + 4);
        if (endIdx === -1) {
          inHtmlComment = true;
          i = line.length;
        } else {
          i = endIdx + 3;
        }
        continue;
      }
      result += line[i];
      i++;
    }
    if (result.trim() !== "" || line.trim() === "") {
      out.push(result);
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function safeRealpath(filePath) {
  return canonicalizeFsPath(filePath);
}
function buildCanonicalPathSet(paths) {
  if (!paths || paths.size === 0) return void 0;
  const set = /* @__PURE__ */ new Set();
  for (const p of paths) {
    if (!p || !p.trim()) continue;
    set.add(path4.resolve(p));
    set.add(safeRealpath(p));
  }
  return set;
}
function isTrustedRuleScope(scope) {
  return scope === "managed" || scope === "user" || scope === "user_rule";
}
function isPathWithinRoot(targetPath, rootPath) {
  const rel = path4.relative(rootPath, targetPath);
  if (rel === "") return true;
  if (rel === ".." || rel.startsWith(`..${path4.sep}`) || rel.startsWith("../")) {
    return false;
  }
  if (path4.isAbsolute(rel)) return false;
  return true;
}
function buildWorkspaceTrustContext(workspaceRoot, options) {
  const workspaceRealRoot = safeRealpath(workspaceRoot);
  const wsTrust = getWorkspaceExternalTrust(options?.externalRuleTrust, workspaceRoot);
  const claudeCodeApproval = readClaudeCodeExternalApproval(workspaceRoot, {
    claudeConfigDir: options?.claudeConfigDir,
    homeDir: options?.homeDir,
    claudeStateFilePath: options?.claudeStateFilePath
  });
  return {
    workspaceRealRoot,
    allowedRoots: [workspaceRealRoot],
    allowPaths: wsTrust.allowPaths,
    denyPaths: wsTrust.denyPaths,
    trustClaudeCodeExternalApprovals: options?.trustClaudeCodeExternalApprovals ?? true,
    claudeCodeApproval
  };
}
function evaluateExternalTargetTrust(targetRealPath, trustCtx) {
  for (const root of trustCtx.allowedRoots) {
    if (isPathWithinRoot(targetRealPath, root)) {
      return { allowed: true, internal: true };
    }
  }
  let bestDenyLen = -1;
  for (const denied of trustCtx.denyPaths) {
    if (isPathWithinRoot(targetRealPath, denied) && denied.length > bestDenyLen) {
      bestDenyLen = denied.length;
    }
  }
  let bestAllowPath = null;
  let bestAllowLen = -1;
  for (const allowed of trustCtx.allowPaths) {
    if (isPathWithinRoot(targetRealPath, allowed) && allowed.length > bestAllowLen) {
      bestAllowLen = allowed.length;
      bestAllowPath = allowed;
    }
  }
  if (bestDenyLen >= 0 || bestAllowLen >= 0) {
    if (bestAllowLen > bestDenyLen && bestAllowPath !== null) {
      return {
        allowed: true,
        internal: false,
        approvedBy: targetRealPath === bestAllowPath ? "plugin_file_allowlist" : "plugin_dir_allowlist"
      };
    }
    return { allowed: false, status: "denied_by_plugin" };
  }
  if (trustCtx.trustClaudeCodeExternalApprovals && trustCtx.claudeCodeApproval) {
    if (trustCtx.claudeCodeApproval.approved) {
      return {
        allowed: true,
        internal: false,
        approvedBy: "claude_code_project_approval"
      };
    }
    if (trustCtx.claudeCodeApproval.warningShown) {
      return { allowed: false, status: "denied_by_claude_code" };
    }
  }
  return { allowed: false, status: "pending_approval" };
}
function formatDisplayPath(filePath, workspaceRoot) {
  if (workspaceRoot) {
    const rel = path4.relative(workspaceRoot, filePath);
    if (rel && !rel.startsWith("..") && !path4.isAbsolute(rel)) {
      return rel.replace(/\\/g, "/");
    }
    if (rel === "") return path4.basename(filePath);
  }
  const home = os3.homedir();
  if (filePath === home || filePath.startsWith(home + path4.sep)) {
    return "~" + filePath.slice(home.length);
  }
  return filePath;
}
function dedupeBlockedTargets(items) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.kind}|${item.sourceFile}|${item.rawRef ?? ""}|${item.resolvedTarget}|${item.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  out.sort(
    (a, b) => a.sourceDisplayPath.localeCompare(b.sourceDisplayPath) || a.resolvedTarget.localeCompare(b.resolvedTarget) || a.kind.localeCompare(b.kind)
  );
  return out;
}
function dedupeApprovedTargets(items) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.kind}|${item.sourceDisplayPath}|${item.resolvedTarget}|${item.approvedBy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  out.sort(
    (a, b) => a.sourceDisplayPath.localeCompare(b.sourceDisplayPath) || a.resolvedTarget.localeCompare(b.resolvedTarget) || a.kind.localeCompare(b.kind)
  );
  return out;
}
function isNativeHostRuleInWorkspace(resolvedPath, workspaceRoots, nativeRuleFilenames = DEFAULT_NATIVE_RULE_FILENAMES) {
  const base = path4.basename(resolvedPath);
  if (!nativeRuleFilenames.includes(base)) return false;
  for (const ws of workspaceRoots) {
    const normWs = safeRealpath(ws);
    if (isPathWithinRoot(resolvedPath, normWs)) {
      return true;
    }
  }
  return false;
}
function expandAtImports(rawContent, sourceFilePath, options) {
  const workspaceRoot = options?.workspaceRoot;
  const workspaceRoots = options?.workspaceRoots ?? [];
  const deduplicateNativeAgentsMd = options?.deduplicateNativeAgentsMd ?? true;
  const nativeRuleFilenames = options?.nativeRuleFilenames ?? DEFAULT_NATIVE_RULE_FILENAMES;
  const hostName = options?.hostName ?? DEFAULT_HOST_NAME;
  const canonicalLoaded = buildCanonicalPathSet(options?.alreadyLoadedPaths);
  const maxDepth = options?.maxDepth ?? MAX_IMPORT_DEPTH;
  const externalTrust = options?.externalTrust;
  const sourceScope = options?.sourceScope ?? "project";
  const imports = [];
  const topLevelImportedBlocks = [];
  const skippedDuplicateAgentsMd = [];
  const blockedExternalTargets = [];
  const approvedExternalTargets = [];
  function processText(content2, currentFile, depth, stack) {
    const lines = content2.replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let inFence = false;
    let fenceChar = "";
    for (const line of lines) {
      const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
      if (fenceMatch) {
        if (!inFence) {
          inFence = true;
          fenceChar = fenceMatch[1][0];
        } else if (fenceMatch[1][0] === fenceChar) {
          inFence = false;
          fenceChar = "";
        }
        out.push(line);
        continue;
      }
      if (inFence || depth >= maxDepth) {
        out.push(line);
        continue;
      }
      const standaloneMatch = /^\s*(?:@import\s+|@)(~\/[^\s`]+|\.{0,2}\/[^\s`]+|[A-Za-z0-9._/-]+\.(?:md|markdown|txt))\s*$/i.exec(
        line
      );
      if (!standaloneMatch) {
        out.push(line);
        continue;
      }
      const rawRef = standaloneMatch[1].replace(/[),.;:]+$/, "");
      const candidatePath = rawRef.startsWith("~/") ? expandHome(rawRef) : path4.resolve(path4.dirname(currentFile), rawRef);
      if (!fs4.existsSync(candidatePath)) {
        out.push(line);
        continue;
      }
      let st;
      try {
        st = fs4.statSync(candidatePath);
        if (!st.isFile()) {
          out.push(line);
          continue;
        }
      } catch {
        out.push(line);
        continue;
      }
      const realTarget = safeRealpath(candidatePath);
      if (stack.has(realTarget)) {
        continue;
      }
      if (externalTrust) {
        const decision = evaluateExternalTargetTrust(realTarget, externalTrust);
        const curDisplay = formatDisplayPath(currentFile, workspaceRoot);
        if (!decision.allowed) {
          blockedExternalTargets.push({
            kind: "external_import",
            sourceFile: path4.resolve(currentFile),
            sourceDisplayPath: curDisplay,
            sourceScope,
            rawRef,
            resolvedTarget: realTarget,
            targetIsDir: false,
            status: decision.status
          });
          out.push(
            `<!-- [unified-memory] skipped untrusted external @${rawRef} (${decision.status}) -->`
          );
          continue;
        }
        if (!decision.internal) {
          approvedExternalTargets.push({
            kind: "external_import",
            sourceDisplayPath: curDisplay,
            resolvedTarget: realTarget,
            approvedBy: decision.approvedBy
          });
        }
      }
      const alreadyLoadedTarget = canonicalLoaded !== void 0 && (canonicalLoaded.has(realTarget) || canonicalLoaded.has(path4.resolve(candidatePath)));
      if (deduplicateNativeAgentsMd && (alreadyLoadedTarget || isNativeHostRuleInWorkspace(realTarget, workspaceRoots, nativeRuleFilenames))) {
        skippedDuplicateAgentsMd.push(realTarget);
        out.push(
          `<!-- [unified-memory] skipped duplicate @${rawRef} (already natively loaded by ${hostName}) -->`
        );
        continue;
      }
      imports.push(realTarget);
      const nextStack = new Set(stack);
      nextStack.add(realTarget);
      const importedRaw = fs4.readFileSync(realTarget, "utf8");
      const expandedChild = processText(importedRaw, realTarget, depth + 1, nextStack);
      const wrapped = `
<!-- imported from ${rawRef} -->
${expandedChild}
<!-- end import ${rawRef} -->
`;
      if (depth === 0) {
        topLevelImportedBlocks.push(`#### @${rawRef}
${expandedChild}`);
      }
      out.push(wrapped);
    }
    return out.join("\n");
  }
  const rootReal = safeRealpath(sourceFilePath);
  const initialStack = /* @__PURE__ */ new Set([rootReal]);
  const content = processText(rawContent, sourceFilePath, 0, initialStack);
  return {
    content,
    importedOnlyContent: topLevelImportedBlocks.join("\n\n"),
    imports,
    skippedDuplicateAgentsMd,
    blockedExternalTargets: dedupeBlockedTargets(blockedExternalTargets),
    approvedExternalTargets: dedupeApprovedTargets(approvedExternalTargets)
  };
}
function walkRulesDirectoryWithTrust(rulesDir, options) {
  const files = [];
  const blocked = [];
  const approvedDirs = [];
  const excludedPaths = [];
  if (!fs4.existsSync(rulesDir)) {
    return { files, blocked, approvedDirs, excludedPaths };
  }
  const workspaceRoot = options?.workspaceRoot;
  const excludes = options?.excludes ?? [];
  const externalTrust = options?.externalTrust;
  const sourceScope = options?.sourceScope ?? "project_rule";
  if (externalTrust) {
    let rootStat;
    try {
      rootStat = fs4.statSync(rulesDir);
      if (!rootStat.isDirectory()) {
        return { files, blocked, approvedDirs, excludedPaths };
      }
    } catch {
      return { files, blocked, approvedDirs, excludedPaths };
    }
    const realRootDir = safeRealpath(rulesDir);
    const rootDecision = evaluateExternalTargetTrust(realRootDir, externalTrust);
    const rootDisplay = formatDisplayPath(rulesDir, workspaceRoot);
    if (!rootDecision.allowed) {
      blocked.push({
        kind: "external_rule_dir_symlink",
        sourceFile: path4.resolve(rulesDir),
        sourceDisplayPath: rootDisplay,
        sourceScope,
        resolvedTarget: realRootDir,
        targetIsDir: true,
        status: rootDecision.status
      });
      return { files, blocked: dedupeBlockedTargets(blocked), approvedDirs, excludedPaths };
    }
    if (!rootDecision.internal) {
      approvedDirs.push({
        kind: "external_rule_dir_symlink",
        sourceDisplayPath: rootDisplay,
        resolvedTarget: realRootDir,
        approvedBy: rootDecision.approvedBy
      });
    }
  }
  const visitedDirs = /* @__PURE__ */ new Set();
  function visit(dir) {
    const realDir = safeRealpath(dir);
    if (visitedDirs.has(realDir)) return;
    visitedDirs.add(realDir);
    let entries;
    try {
      entries = fs4.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = path4.join(dir, entry.name);
      if (excludes.length > 0 && isExcludedPath(fullPath, workspaceRoot, excludes)) {
        excludedPaths.push(fullPath);
        continue;
      }
      let stat;
      try {
        stat = fs4.statSync(fullPath);
      } catch {
        continue;
      }
      const realTarget = safeRealpath(fullPath);
      const displayPath = formatDisplayPath(fullPath, workspaceRoot);
      if (stat.isDirectory()) {
        if (externalTrust) {
          const decision = evaluateExternalTargetTrust(realTarget, externalTrust);
          if (!decision.allowed) {
            blocked.push({
              kind: "external_rule_dir_symlink",
              sourceFile: path4.resolve(fullPath),
              sourceDisplayPath: displayPath,
              sourceScope,
              resolvedTarget: realTarget,
              targetIsDir: true,
              status: decision.status
            });
            continue;
          }
          if (!decision.internal) {
            approvedDirs.push({
              kind: "external_rule_dir_symlink",
              sourceDisplayPath: displayPath,
              resolvedTarget: realTarget,
              approvedBy: decision.approvedBy
            });
          }
        }
        visit(fullPath);
      } else if (stat.isFile() && entry.name.endsWith(".md")) {
        if (externalTrust) {
          const decision = evaluateExternalTargetTrust(realTarget, externalTrust);
          if (!decision.allowed) {
            blocked.push({
              kind: "external_rule_symlink",
              sourceFile: path4.resolve(fullPath),
              sourceDisplayPath: displayPath,
              sourceScope,
              resolvedTarget: realTarget,
              targetIsDir: false,
              status: decision.status
            });
            continue;
          }
          if (!decision.internal) {
            files.push({
              filePath: fullPath,
              approvedExternal: {
                kind: "external_rule_symlink",
                sourceDisplayPath: displayPath,
                resolvedTarget: realTarget,
                approvedBy: decision.approvedBy
              }
            });
            continue;
          }
        }
        files.push({ filePath: fullPath });
      }
    }
  }
  visit(rulesDir);
  return {
    files,
    blocked: dedupeBlockedTargets(blocked),
    approvedDirs: dedupeApprovedTargets(approvedDirs),
    excludedPaths
  };
}
function walkRulesDirectory(rulesDir) {
  return walkRulesDirectoryWithTrust(rulesDir).files.map((f) => f.filePath);
}
function isExcludedPath(filePath, workspaceRoot, excludes) {
  if (excludes.length === 0) return false;
  const candidates = [filePath.replace(/\\/g, "/")];
  if (workspaceRoot) {
    const rel = path4.relative(workspaceRoot, filePath).replace(/\\/g, "/");
    if (!rel.startsWith("..")) {
      candidates.push(rel);
    }
  }
  return candidates.some((c) => matchesGlobPatterns(c, excludes));
}
function loadSingleRuleFileWithDiagnostics(filePath, scope, options) {
  if (!fs4.existsSync(filePath)) {
    return { entry: null, blocked: [], approved: [] };
  }
  let st;
  try {
    st = fs4.statSync(filePath);
    if (!st.isFile()) {
      return { entry: null, blocked: [], approved: [] };
    }
  } catch {
    return { entry: null, blocked: [], approved: [] };
  }
  const resolvedFilePath = path4.resolve(filePath);
  const realFilePath = safeRealpath(filePath);
  const displayPath = formatDisplayPath(filePath, options.workspaceRoot);
  const approved = [];
  if (!isTrustedRuleScope(scope) && options.fileTrustCtx) {
    const decision = evaluateExternalTargetTrust(realFilePath, options.fileTrustCtx);
    if (!decision.allowed) {
      return {
        entry: null,
        blocked: [
          {
            kind: "external_rule_symlink",
            sourceFile: resolvedFilePath,
            sourceDisplayPath: displayPath,
            sourceScope: scope,
            resolvedTarget: realFilePath,
            targetIsDir: false,
            status: decision.status
          }
        ],
        approved: []
      };
    }
    if (!decision.internal) {
      approved.push({
        kind: "external_rule_symlink",
        sourceDisplayPath: displayPath,
        resolvedTarget: realFilePath,
        approvedBy: decision.approvedBy
      });
    }
  }
  const raw = fs4.readFileSync(realFilePath, "utf8");
  let body = raw;
  let pathsList = null;
  if (options.parsePathsFrontmatter) {
    const parsed = parseFrontmatter(raw);
    if (parsed.hasFrontmatter && !parsed.parseError) {
      body = parsed.body;
      const rawPaths = parsed.data.paths;
      if (Array.isArray(rawPaths)) {
        const clean = rawPaths.filter((p) => typeof p === "string" && p.trim().length > 0).map((p) => p.trim());
        if (clean.length > 0) pathsList = clean;
      } else if (typeof rawPaths === "string" && rawPaths.trim()) {
        pathsList = rawPaths.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
  }
  const expanded = expandAtImports(body, filePath, {
    workspaceRoot: options.workspaceRoot,
    workspaceRoots: options.workspaceRoots,
    deduplicateNativeAgentsMd: options.deduplicateNativeAgentsMd,
    nativeRuleFilenames: options.nativeRuleFilenames,
    hostName: options.hostName,
    alreadyLoadedPaths: options.canonicalAlreadyLoaded,
    externalTrust: isTrustedRuleScope(scope) ? void 0 : options.importTrustCtx,
    sourceScope: scope
  });
  const allBlocked = dedupeBlockedTargets(expanded.blockedExternalTargets);
  const allApproved = dedupeApprovedTargets([...approved, ...expanded.approvedExternalTargets]);
  const cleaned = stripHtmlComments(expanded.content);
  const cleanedImportedOnly = expanded.importedOnlyContent ? stripHtmlComments(expanded.importedOnlyContent) : "";
  if (!cleaned.trim() && !cleanedImportedOnly.trim()) {
    return { entry: null, blocked: allBlocked, approved: allApproved };
  }
  const dedupedByHost = Boolean(
    options.canonicalAlreadyLoaded && (options.canonicalAlreadyLoaded.has(realFilePath) || options.canonicalAlreadyLoaded.has(resolvedFilePath))
  );
  return {
    entry: {
      id: realFilePath,
      filePath: resolvedFilePath,
      displayPath,
      scope,
      workspaceRoot: options.workspaceRoot,
      paths: pathsList,
      isConditional: pathsList !== null && pathsList.length > 0,
      content: cleaned,
      dedupedByHost,
      importedOnlyContent: cleanedImportedOnly,
      imports: expanded.imports,
      skippedDuplicateAgentsMd: expanded.skippedDuplicateAgentsMd,
      blockedExternalTargets: allBlocked,
      approvedExternalTargets: allApproved,
      sizeBytes: Buffer.byteLength(cleaned, "utf8"),
      mtimeMs: st.mtimeMs
    },
    blocked: allBlocked,
    approved: allApproved
  };
}
function getManagedClaudeMdPath(platform = process.platform) {
  if (platform === "darwin") {
    return "/Library/Application Support/ClaudeCode/CLAUDE.md";
  }
  if (platform === "win32") {
    return "C:\\ProgramData\\ClaudeCode\\CLAUDE.md";
  }
  return "/etc/claude-code/CLAUDE.md";
}
function loadClaudeRulesForWorkspaces(workspacePaths, options) {
  const claudeConfigDir = options?.claudeConfigDir ?? getClaudeConfigDir();
  const homeDir = options?.homeDir ?? os3.homedir();
  const homeReal = safeRealpath(homeDir);
  const deduplicateNativeAgentsMd = options?.deduplicateNativeAgentsMd ?? true;
  const nativeRuleFilenames = options?.nativeRuleFilenames ?? DEFAULT_NATIVE_RULE_FILENAMES;
  const hostName = options?.hostName ?? DEFAULT_HOST_NAME;
  const canonicalAlreadyLoaded = buildCanonicalPathSet(options?.alreadyLoadedPaths);
  const seenGlobalIds = /* @__PURE__ */ new Set();
  const globalAlwaysOn = [];
  const globalConditional = [];
  const userSettings = readClaudeSettings(void 0, claudeConfigDir);
  const globalExcludes = userSettings.claudeMdExcludes;
  const pushGlobal = (entry) => {
    if (!entry || seenGlobalIds.has(entry.id)) return;
    seenGlobalIds.add(entry.id);
    if (entry.isConditional) {
      globalConditional.push(entry);
    } else {
      globalAlwaysOn.push(entry);
    }
  };
  const managedPath = getManagedClaudeMdPath(options?.platform);
  if (!isExcludedPath(managedPath, void 0, globalExcludes)) {
    pushGlobal(
      loadSingleRuleFileWithDiagnostics(managedPath, "managed", {
        workspaceRoots: workspacePaths,
        deduplicateNativeAgentsMd,
        nativeRuleFilenames,
        hostName,
        canonicalAlreadyLoaded,
        parsePathsFrontmatter: false
      }).entry
    );
  }
  const userClaudeMd = path4.join(claudeConfigDir, "CLAUDE.md");
  if (!isExcludedPath(userClaudeMd, void 0, globalExcludes)) {
    pushGlobal(
      loadSingleRuleFileWithDiagnostics(userClaudeMd, "user", {
        workspaceRoots: workspacePaths,
        deduplicateNativeAgentsMd,
        nativeRuleFilenames,
        hostName,
        canonicalAlreadyLoaded,
        parsePathsFrontmatter: false
      }).entry
    );
  }
  const userRulesDir = path4.join(claudeConfigDir, "rules");
  for (const ruleFile of walkRulesDirectory(userRulesDir)) {
    if (isExcludedPath(ruleFile, void 0, globalExcludes)) continue;
    pushGlobal(
      loadSingleRuleFileWithDiagnostics(ruleFile, "user_rule", {
        workspaceRoots: workspacePaths,
        deduplicateNativeAgentsMd,
        nativeRuleFilenames,
        hostName,
        canonicalAlreadyLoaded,
        parsePathsFrontmatter: true
      }).entry
    );
  }
  const workspaces = [];
  for (const rawWs of workspacePaths) {
    if (!rawWs || !fs4.existsSync(rawWs)) continue;
    const wsRoot = path4.resolve(rawWs);
    const wsSettings = readClaudeSettings(wsRoot, claudeConfigDir);
    const excludes = wsSettings.claudeMdExcludes;
    const seenWs = new Set(seenGlobalIds);
    const alwaysOn = [];
    const conditional = [];
    const excludedPaths = [];
    const wsBlocked = [];
    const wsApproved = [];
    const wsTrustCtx = buildWorkspaceTrustContext(wsRoot, {
      claudeConfigDir,
      homeDir,
      claudeStateFilePath: options?.claudeStateFilePath,
      trustClaudeCodeExternalApprovals: options?.trustClaudeCodeExternalApprovals,
      externalRuleTrust: options?.externalRuleTrust
    });
    const gitTopLevel = resolveGitTopLevel(wsRoot);
    const addWsEntry = (filePath, scope, parsePathsFrontmatter, trustOverride) => {
      if (!fs4.existsSync(filePath)) return;
      if (isExcludedPath(filePath, wsRoot, excludes)) {
        excludedPaths.push(filePath);
        return;
      }
      const res = loadSingleRuleFileWithDiagnostics(filePath, scope, {
        workspaceRoot: wsRoot,
        workspaceRoots: [wsRoot],
        deduplicateNativeAgentsMd,
        nativeRuleFilenames,
        hostName,
        canonicalAlreadyLoaded,
        parsePathsFrontmatter,
        fileTrustCtx: trustOverride?.fileTrustCtx ?? wsTrustCtx,
        importTrustCtx: trustOverride?.importTrustCtx ?? wsTrustCtx
      });
      if (res.blocked.length > 0) wsBlocked.push(...res.blocked);
      if (res.approved.length > 0) wsApproved.push(...res.approved);
      const entry = res.entry;
      if (!entry || seenWs.has(entry.id)) return;
      seenWs.add(entry.id);
      if (entry.isConditional) {
        conditional.push(entry);
      } else {
        alwaysOn.push(entry);
      }
    };
    const ancestors = [];
    let cur = path4.dirname(wsRoot);
    while (cur && cur !== path4.dirname(cur)) {
      ancestors.unshift(cur);
      cur = path4.dirname(cur);
    }
    for (const anc of ancestors) {
      const ancReal = safeRealpath(anc);
      const inSameGitRepo = gitTopLevel !== null && gitTopLevel !== path4.parse(gitTopLevel).root && gitTopLevel !== homeReal && isPathWithinRoot(ancReal, gitTopLevel);
      const ancImportTrust = inSameGitRepo ? {
        ...wsTrustCtx,
        allowedRoots: Array.from(/* @__PURE__ */ new Set([wsTrustCtx.workspaceRealRoot, gitTopLevel]))
      } : wsTrustCtx;
      const ancFileTrust = {
        ...ancImportTrust,
        allowedRoots: Array.from(/* @__PURE__ */ new Set([...ancImportTrust.allowedRoots, ancReal]))
      };
      const ancOverride = { fileTrustCtx: ancFileTrust, importTrustCtx: ancImportTrust };
      if (anc === homeDir || ancReal === homeReal) {
        addWsEntry(path4.join(anc, "CLAUDE.md"), "ancestor", false, ancOverride);
        continue;
      }
      addWsEntry(path4.join(anc, "CLAUDE.md"), "ancestor", false, ancOverride);
      addWsEntry(path4.join(anc, ".claude", "CLAUDE.md"), "ancestor", false, ancOverride);
    }
    addWsEntry(path4.join(wsRoot, "CLAUDE.md"), "project", false);
    addWsEntry(path4.join(wsRoot, ".claude", "CLAUDE.md"), "project", false);
    const projRulesDir = path4.join(wsRoot, ".claude", "rules");
    const walked = walkRulesDirectoryWithTrust(projRulesDir, {
      workspaceRoot: wsRoot,
      excludes,
      externalTrust: wsTrustCtx,
      sourceScope: "project_rule"
    });
    if (walked.excludedPaths.length > 0) excludedPaths.push(...walked.excludedPaths);
    if (walked.blocked.length > 0) wsBlocked.push(...walked.blocked);
    if (walked.approvedDirs.length > 0) wsApproved.push(...walked.approvedDirs);
    for (const item of walked.files) {
      addWsEntry(item.filePath, "project_rule", true);
    }
    addWsEntry(path4.join(wsRoot, "CLAUDE.local.md"), "local", false);
    workspaces.push({
      workspaceRoot: wsRoot,
      alwaysOn,
      conditional,
      excludedPaths,
      blockedExternalTargets: dedupeBlockedTargets(wsBlocked),
      approvedExternalTargets: dedupeApprovedTargets(wsApproved),
      claudeCodeExternalApproval: wsTrustCtx.claudeCodeApproval
    });
  }
  return { globalAlwaysOn, globalConditional, workspaces };
}
function findSubdirectoryClaudeMdsWithDiagnostics(accessedFilePath, workspaceRoot, options) {
  const absFile = path4.resolve(accessedFilePath);
  const absWs = path4.resolve(workspaceRoot);
  if (absFile !== absWs && !absFile.startsWith(absWs + path4.sep)) {
    return { entries: [], blocked: [], approved: [] };
  }
  const claudeConfigDir = options?.claudeConfigDir ?? getClaudeConfigDir();
  const wsSettings = readClaudeSettings(absWs, claudeConfigDir);
  const excludes = wsSettings.claudeMdExcludes;
  const wsTrustCtx = buildWorkspaceTrustContext(absWs, options);
  const canonicalAlreadyLoaded = buildCanonicalPathSet(options?.alreadyLoadedPaths);
  const dirs = [];
  let cur = path4.dirname(absFile);
  while (cur.length > absWs.length && cur.startsWith(absWs + path4.sep)) {
    dirs.unshift(cur);
    const parent = path4.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  const entries = [];
  const blocked = [];
  const approved = [];
  const seen = /* @__PURE__ */ new Set();
  for (const dir of dirs) {
    for (const candidate of [
      path4.join(dir, "CLAUDE.md"),
      path4.join(dir, ".claude", "CLAUDE.md"),
      path4.join(dir, "CLAUDE.local.md")
    ]) {
      if (!fs4.existsSync(candidate)) continue;
      if (isExcludedPath(candidate, absWs, excludes)) continue;
      const res = loadSingleRuleFileWithDiagnostics(candidate, "subdir", {
        workspaceRoot: absWs,
        workspaceRoots: [absWs],
        deduplicateNativeAgentsMd: options?.deduplicateNativeAgentsMd ?? true,
        nativeRuleFilenames: options?.nativeRuleFilenames ?? DEFAULT_NATIVE_RULE_FILENAMES,
        hostName: options?.hostName ?? DEFAULT_HOST_NAME,
        canonicalAlreadyLoaded,
        parsePathsFrontmatter: false,
        fileTrustCtx: wsTrustCtx,
        importTrustCtx: wsTrustCtx
      });
      if (res.blocked.length > 0) blocked.push(...res.blocked);
      if (res.approved.length > 0) approved.push(...res.approved);
      if (res.entry && !seen.has(res.entry.id)) {
        seen.add(res.entry.id);
        entries.push(res.entry);
      }
    }
  }
  return {
    entries,
    blocked: dedupeBlockedTargets(blocked),
    approved: dedupeApprovedTargets(approved)
  };
}
function loadConditionalRuleContentWithDiagnostics(ruleFilePath, workspaceRoot, scope, options) {
  const trusted = isTrustedRuleScope(scope);
  const wsTrustCtx = trusted ? void 0 : buildWorkspaceTrustContext(workspaceRoot, options);
  const parsePathsFrontmatter = scope === "project_rule" || scope === "user_rule";
  const canonicalAlreadyLoaded = buildCanonicalPathSet(options?.alreadyLoadedPaths);
  return loadSingleRuleFileWithDiagnostics(ruleFilePath, scope, {
    workspaceRoot: trusted ? void 0 : workspaceRoot,
    workspaceRoots: [workspaceRoot],
    deduplicateNativeAgentsMd: options?.deduplicateNativeAgentsMd ?? true,
    nativeRuleFilenames: options?.nativeRuleFilenames ?? DEFAULT_NATIVE_RULE_FILENAMES,
    hostName: options?.hostName ?? DEFAULT_HOST_NAME,
    canonicalAlreadyLoaded,
    parsePathsFrontmatter,
    fileTrustCtx: wsTrustCtx,
    importTrustCtx: wsTrustCtx
  });
}

// src/core/codex/memory.ts
import fs5 from "node:fs";
import os4 from "node:os";
import path5 from "node:path";
function getCodexHome(env = process.env) {
  const configured = env.CODEX_HOME?.trim();
  if (configured) return expandHome(configured);
  return path5.join(os4.homedir(), ".codex");
}
function readCodexConfigFlags(codexHome) {
  const configPath = path5.join(codexHome, "config.toml");
  if (!fs5.existsSync(configPath)) return {};
  try {
    const raw = fs5.readFileSync(configPath, "utf8").replace(/\r\n/g, "\n");
    let section = "";
    const flags = {};
    for (const rawLine of raw.split("\n")) {
      const line = rawLine.replace(/#.*$/, "").trim();
      if (!line) continue;
      const secMatch = /^\[([^\]]+)\]$/.exec(line);
      if (secMatch) {
        section = secMatch[1].trim();
        continue;
      }
      const kv = /^([A-Za-z0-9_-]+)\s*=\s*(true|false)$/i.exec(line);
      if (!kv) continue;
      const key = kv[1];
      const val = kv[2].toLowerCase() === "true";
      if (section === "features" && key === "memories") {
        flags.featuresMemories = val;
      } else if (section === "memories" && key === "generate_memories") {
        flags.generateMemories = val;
      } else if (section === "memories" && key === "use_memories") {
        flags.useMemories = val;
      }
    }
    return flags;
  } catch {
    return {};
  }
}
var DISALLOWED_CODEX_EXT_RE = /\.(?:sqlite|sqlite3|sqlite-wal|sqlite-shm|db|db-wal|db-shm|lock)$/i;
function isDisallowedCodexRelativePath(cleanRel) {
  if (!cleanRel) return true;
  const segments = cleanRel.split("/").filter((s) => s.length > 0);
  if (segments.length === 0) return true;
  for (const seg of segments) {
    if (seg === "." || seg === "..") return true;
    if (seg === ".git" || seg === ".codex-baseline") return true;
  }
  const base = segments[segments.length - 1];
  if (base === "raw_memories.md") return true;
  if (DISALLOWED_CODEX_EXT_RE.test(base)) return true;
  return false;
}
function resolveSafeCodexFile(rootDir, targetPath) {
  try {
    const realRoot = fs5.realpathSync(rootDir);
    const realTarget = fs5.realpathSync(targetPath);
    if (!realTarget.startsWith(realRoot + path5.sep)) {
      return null;
    }
    const realRel = path5.relative(realRoot, realTarget).replace(/\\/g, "/");
    if (isDisallowedCodexRelativePath(realRel)) {
      return null;
    }
    if (!fs5.statSync(realTarget).isFile()) {
      return null;
    }
    return realTarget;
  } catch {
    return null;
  }
}
function collectExtensionFiles(dirPath) {
  const extDir = path5.join(dirPath, "extensions");
  if (!fs5.existsSync(extDir)) return [];
  let realRoot;
  try {
    realRoot = fs5.realpathSync(dirPath);
    const realExt = fs5.realpathSync(extDir);
    if (!realExt.startsWith(realRoot + path5.sep)) return [];
  } catch {
    return [];
  }
  const files = [];
  const visitedDirs = /* @__PURE__ */ new Set();
  function walk(cur, relBase) {
    let realCur;
    try {
      realCur = fs5.realpathSync(cur);
    } catch {
      return;
    }
    if (!realCur.startsWith(realRoot + path5.sep) || visitedDirs.has(realCur)) return;
    visitedDirs.add(realCur);
    let entries;
    try {
      entries = fs5.readdirSync(cur, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path5.join(cur, e.name);
      const rel = relBase ? `${relBase}/${e.name}` : e.name;
      if (e.isDirectory()) {
        walk(full, rel);
      } else if (e.isFile() && (e.name.endsWith(".md") || e.name.endsWith(".txt"))) {
        if (resolveSafeCodexFile(dirPath, full)) {
          files.push(`extensions/${rel}`);
        }
      }
    }
  }
  walk(extDir, "");
  files.sort();
  return files;
}
function inspectGeneration(codexHome, generation) {
  const dirName = generation === "v2" ? "memories_v2" : "memories";
  const dirPath = path5.join(codexHome, dirName);
  const exists = fs5.existsSync(dirPath);
  if (!exists) {
    return {
      generation,
      dirPath,
      exists: false,
      hasSummary: false,
      summaryBytes: 0,
      summaryLines: 0,
      summaryMtimeMs: 0,
      hasHandbook: false,
      handbookBytes: 0,
      rolloutCount: 0,
      extensionFiles: [],
      skillNames: []
    };
  }
  const summaryPath = path5.join(dirPath, "memory_summary.md");
  let hasSummary = false;
  let summaryBytes = 0;
  let summaryLines = 0;
  let summaryMtimeMs = 0;
  const safeSummaryPath = resolveSafeCodexFile(dirPath, summaryPath);
  if (safeSummaryPath) {
    try {
      const st = fs5.statSync(safeSummaryPath);
      hasSummary = true;
      summaryBytes = st.size;
      summaryMtimeMs = st.mtimeMs;
      const text = fs5.readFileSync(safeSummaryPath, "utf8");
      summaryLines = text === "" ? 0 : text.replace(/\r\n/g, "\n").split("\n").length;
    } catch {
    }
  }
  const handbookPath = path5.join(dirPath, "MEMORY.md");
  let hasHandbook = false;
  let handbookBytes = 0;
  const safeHandbookPath = resolveSafeCodexFile(dirPath, handbookPath);
  if (safeHandbookPath) {
    try {
      hasHandbook = true;
      handbookBytes = fs5.statSync(safeHandbookPath).size;
    } catch {
    }
  }
  let rolloutCount = 0;
  const rolloutsDir = path5.join(dirPath, "rollout_summaries");
  if (fs5.existsSync(rolloutsDir)) {
    try {
      rolloutCount = fs5.readdirSync(rolloutsDir, { withFileTypes: true }).filter(
        (e) => e.isFile() && e.name.endsWith(".md") && resolveSafeCodexFile(dirPath, path5.join(rolloutsDir, e.name)) !== null
      ).length;
    } catch {
    }
  }
  const extensionFiles = collectExtensionFiles(dirPath);
  const skillNames = [];
  const skillsDir = path5.join(dirPath, "skills");
  if (fs5.existsSync(skillsDir)) {
    try {
      for (const e of fs5.readdirSync(skillsDir, { withFileTypes: true })) {
        if (e.isDirectory() && resolveSafeCodexFile(dirPath, path5.join(skillsDir, e.name, "SKILL.md")) !== null) {
          skillNames.push(e.name);
        }
      }
      skillNames.sort();
    } catch {
    }
  }
  return {
    generation,
    dirPath,
    exists: true,
    hasSummary,
    summaryBytes,
    summaryLines,
    summaryMtimeMs,
    hasHandbook,
    handbookBytes,
    rolloutCount,
    extensionFiles,
    skillNames
  };
}
function getCodexMemoryStatus(codexHome = getCodexHome()) {
  const exists = fs5.existsSync(codexHome);
  const v2 = inspectGeneration(codexHome, "v2");
  const v1 = inspectGeneration(codexHome, "v1");
  let activeGeneration = "none";
  if (v2.exists && v2.hasSummary) {
    activeGeneration = !v1.hasSummary || v2.summaryMtimeMs >= v1.summaryMtimeMs ? "v2" : "v1";
  } else if (v1.exists && (v1.hasSummary || v1.hasHandbook)) {
    activeGeneration = "v1";
  } else if (v2.exists) {
    activeGeneration = "v2";
  } else if (v1.exists) {
    activeGeneration = "v1";
  }
  return {
    codexHome,
    exists,
    configFlags: readCodexConfigFlags(codexHome),
    activeGeneration,
    v2,
    v1,
    hasGlobalAgentsMd: fs5.existsSync(path5.join(codexHome, "AGENTS.md")),
    hasGlobalAgentsOverrideMd: fs5.existsSync(path5.join(codexHome, "AGENTS.override.md"))
  };
}
function stripCodexVersionHeader(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines.length > 0 && /^v\d+$/i.test(lines[0].trim())) {
    let start = 1;
    while (start < lines.length && lines[start].trim() === "") {
      start++;
    }
    return lines.slice(start).join("\n");
  }
  return normalized;
}
function truncateByBytesOnLineBoundary(text, maxBytes) {
  const totalBytes = Buffer.byteLength(text, "utf8");
  if (totalBytes <= maxBytes) {
    return { content: text, truncated: false, totalBytes };
  }
  const lines = text.split("\n");
  const kept = [];
  let used = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineBytes = Buffer.byteLength(lines[i], "utf8") + (i > 0 ? 1 : 0);
    if (used + lineBytes > maxBytes) break;
    kept.push(lines[i]);
    used += lineBytes;
  }
  return { content: kept.join("\n"), truncated: true, totalBytes };
}
function readCodexSummary(options) {
  const codexHome = options?.codexHome ?? getCodexHome();
  const status = getCodexMemoryStatus(codexHome);
  const chosen = options?.generation && options.generation !== "auto" ? options.generation : status.activeGeneration;
  if (chosen === "none") {
    return { generation: "none", content: "", truncated: false, totalBytes: 0, mtimeMs: 0 };
  }
  const genStats = chosen === "v2" ? status.v2 : status.v1;
  const summaryPath = path5.join(genStats.dirPath, "memory_summary.md");
  const safeSummaryPath = resolveSafeCodexFile(genStats.dirPath, summaryPath);
  if (!safeSummaryPath) {
    return { generation: chosen, content: "", truncated: false, totalBytes: 0, mtimeMs: 0 };
  }
  const st = fs5.statSync(safeSummaryPath);
  const raw = fs5.readFileSync(safeSummaryPath, "utf8");
  const cleaned = stripCodexVersionHeader(raw);
  const maxBytes = options?.maxBytes ?? 8 * 1024;
  const trunc = truncateByBytesOnLineBoundary(cleaned, maxBytes);
  return {
    generation: chosen,
    filePath: summaryPath,
    content: trunc.content,
    truncated: trunc.truncated,
    totalBytes: trunc.totalBytes,
    mtimeMs: st.mtimeMs
  };
}
function readCodexGlobalAgentsMd(codexHome = getCodexHome()) {
  const overridePath = path5.join(codexHome, "AGENTS.override.md");
  if (fs5.existsSync(overridePath)) {
    return {
      filePath: overridePath,
      isOverride: true,
      content: fs5.readFileSync(overridePath, "utf8").trim()
    };
  }
  const agentsPath = path5.join(codexHome, "AGENTS.md");
  if (fs5.existsSync(agentsPath)) {
    return {
      filePath: agentsPath,
      isOverride: false,
      content: fs5.readFileSync(agentsPath, "utf8").trim()
    };
  }
  return null;
}
function readCodexMemoryFile(generation, relativePath, codexHome = getCodexHome(), maxBytes = 64 * 1024) {
  const dirName = generation === "v2" ? "memories_v2" : "memories";
  const rootDir = path5.resolve(codexHome, dirName);
  const cleanRel = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (isDisallowedCodexRelativePath(cleanRel)) {
    throw new Error(`Disallowed Codex memory path: ${relativePath}`);
  }
  const target = path5.resolve(rootDir, cleanRel);
  if (!target.startsWith(rootDir + path5.sep)) {
    throw new Error(`Path escapes Codex memory root: ${relativePath}`);
  }
  if (!fs5.existsSync(target) || !fs5.statSync(target).isFile()) {
    throw new Error(`Codex memory file not found: ${generation}/${cleanRel}`);
  }
  const realRoot = fs5.realpathSync(rootDir);
  const realTarget = fs5.realpathSync(target);
  if (!realTarget.startsWith(realRoot + path5.sep)) {
    throw new Error(`Path escapes Codex memory root via symlink: ${relativePath}`);
  }
  const realRel = path5.relative(realRoot, realTarget).replace(/\\/g, "/");
  if (isDisallowedCodexRelativePath(realRel)) {
    throw new Error(`Disallowed Codex memory symlink target: ${relativePath}`);
  }
  const st = fs5.statSync(realTarget);
  const raw = fs5.readFileSync(realTarget, "utf8");
  const text = cleanRel === "memory_summary.md" ? stripCodexVersionHeader(raw) : raw;
  const trunc = truncateByBytesOnLineBoundary(text, maxBytes);
  return {
    generation,
    relativePath: cleanRel,
    filePath: target,
    content: trunc.content,
    truncated: trunc.truncated,
    totalBytes: trunc.totalBytes,
    mtimeMs: st.mtimeMs
  };
}
function listCodexFiles(generation, codexHome = getCodexHome()) {
  const stats = inspectGeneration(codexHome, generation);
  if (!stats.exists) return [];
  const items = [];
  if (stats.hasSummary) {
    items.push({
      category: "summary",
      relativePath: "memory_summary.md",
      title: "memory_summary.md",
      sizeBytes: stats.summaryBytes,
      mtimeMs: stats.summaryMtimeMs
    });
  }
  if (stats.hasHandbook) {
    const hbPath = path5.join(stats.dirPath, "MEMORY.md");
    items.push({
      category: "handbook",
      relativePath: "MEMORY.md",
      title: "MEMORY.md (Handbook)",
      sizeBytes: stats.handbookBytes,
      mtimeMs: fs5.statSync(hbPath).mtimeMs
    });
  }
  for (const extRel of stats.extensionFiles) {
    const full = path5.join(stats.dirPath, extRel);
    try {
      const st = fs5.statSync(full);
      items.push({
        category: "extension",
        relativePath: extRel,
        title: extRel,
        sizeBytes: st.size,
        mtimeMs: st.mtimeMs
      });
    } catch {
    }
  }
  for (const skill of stats.skillNames) {
    const rel = `skills/${skill}/SKILL.md`;
    const full = path5.join(stats.dirPath, rel);
    try {
      const st = fs5.statSync(full);
      items.push({
        category: "skill",
        relativePath: rel,
        title: `skill: ${skill}`,
        sizeBytes: st.size,
        mtimeMs: st.mtimeMs
      });
    } catch {
    }
  }
  const rolloutsDir = path5.join(stats.dirPath, "rollout_summaries");
  if (fs5.existsSync(rolloutsDir)) {
    try {
      for (const e of fs5.readdirSync(rolloutsDir, { withFileTypes: true })) {
        if (!e.isFile() || !e.name.endsWith(".md")) continue;
        const rel = `rollout_summaries/${e.name}`;
        const safePath = resolveSafeCodexFile(stats.dirPath, path5.join(rolloutsDir, e.name));
        if (!safePath) continue;
        const st = fs5.statSync(safePath);
        items.push({
          category: "rollout",
          relativePath: rel,
          title: e.name.replace(/\.md$/, ""),
          sizeBytes: st.size,
          mtimeMs: st.mtimeMs
        });
      }
    } catch {
    }
  }
  items.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return items;
}
var QUERY_SPLIT_RE = /[\s,;:()[\]{}"'`/\\，。；：、（）【】《》“”‘’？！·—…]+/;
var HAN_RUN_RE = new RegExp("\\p{Script=Han}+", "gu");
function tokenizeQuery(q) {
  const exactSet = /* @__PURE__ */ new Set();
  const bigramSet = /* @__PURE__ */ new Set();
  const parts = q.toLowerCase().split(QUERY_SPLIT_RE).map((t) => t.trim()).filter(Boolean);
  for (const part of parts) {
    const hasHan = new RegExp("\\p{Script=Han}", "u").test(part);
    if (part.length >= 2 || hasHan && parts.length === 1) {
      exactSet.add(part);
    }
    if (hasHan) {
      for (const match of part.matchAll(HAN_RUN_RE)) {
        const run = match[0];
        if (run.length >= 2) {
          exactSet.add(run);
        }
        if (run.length >= 3) {
          for (let i = 0; i < run.length - 1 && bigramSet.size < 24; i++) {
            const bg = run.slice(i, i + 2);
            if (!exactSet.has(bg)) {
              bigramSet.add(bg);
            }
          }
        }
      }
      for (const latin of part.match(/[a-z0-9._-]{2,}/g) ?? []) {
        exactSet.add(latin);
      }
    }
  }
  return {
    exact: Array.from(exactSet),
    bigrams: Array.from(bigramSet)
  };
}
function scoreAndExtractSnippet(text, title, terms, projectTerms) {
  const lowerText = text.toLowerCase();
  const lowerTitle = title.toLowerCase();
  let score = 0;
  let bestPos = -1;
  for (const term of terms.exact) {
    if (lowerTitle.includes(term)) score += 6;
    let idx = lowerText.indexOf(term);
    let count = 0;
    while (idx !== -1 && count < 8) {
      if (bestPos === -1) bestPos = idx;
      score += 2;
      count++;
      idx = lowerText.indexOf(term, idx + term.length);
    }
  }
  for (const bg of terms.bigrams) {
    if (lowerTitle.includes(bg)) score += 2;
    let idx = lowerText.indexOf(bg);
    let count = 0;
    while (idx !== -1 && count < 4) {
      if (bestPos === -1) bestPos = idx;
      score += 1;
      count++;
      idx = lowerText.indexOf(bg, idx + bg.length);
    }
  }
  if (score === 0 && (terms.exact.length > 0 || terms.bigrams.length > 0)) {
    return { score: 0, snippet: "" };
  }
  for (const pt of projectTerms.exact) {
    if (lowerTitle.includes(pt)) score += 5;
    if (lowerText.includes(pt)) score += 3;
  }
  const pos = bestPos === -1 ? 0 : Math.max(0, bestPos - 140);
  const rawSnippet = text.slice(pos, pos + 420).replace(/\s+/g, " ").trim();
  const snippet = (pos > 0 ? "..." : "") + rawSnippet + (pos + 420 < text.length ? "..." : "");
  return { score: Math.max(score, 1), snippet };
}
function searchCodexMemories(query, options) {
  const codexHome = options?.codexHome ?? getCodexHome();
  const status = getCodexMemoryStatus(codexHome);
  const limit = Math.min(Math.max(options?.limit ?? 12, 1), 50);
  const terms = tokenizeQuery(query);
  const projectTerms = options?.projectHint ? tokenizeQuery(options.projectHint) : { exact: [], bigrams: [] };
  const gens = [];
  const mode = options?.generation ?? "auto";
  if (mode === "both") {
    if (status.v2.exists) gens.push("v2");
    if (status.v1.exists) gens.push("v1");
  } else if (mode === "v2") {
    if (status.v2.exists) gens.push("v2");
  } else if (mode === "v1") {
    if (status.v1.exists) gens.push("v1");
  } else {
    if (status.activeGeneration !== "none") gens.push(status.activeGeneration);
    if (status.activeGeneration === "v2" && status.v1.exists) {
      gens.push("v1");
    }
  }
  const hits = [];
  const seenRelPaths = /* @__PURE__ */ new Set();
  for (const gen of gens) {
    const genDir = gen === "v2" ? status.v2.dirPath : status.v1.dirPath;
    const files = listCodexFiles(gen, codexHome);
    for (const file of files) {
      if (file.category === "rollout" && seenRelPaths.has(file.relativePath)) continue;
      seenRelPaths.add(file.relativePath);
      const fullPath = resolveSafeCodexFile(genDir, path5.join(genDir, file.relativePath));
      if (!fullPath) continue;
      let text;
      try {
        text = fs5.readFileSync(fullPath, "utf8");
      } catch {
        continue;
      }
      if (file.category === "handbook") {
        const sections = text.split(/(?=^#{1,3}\s+)/m);
        for (const sec of sections) {
          const headingMatch = /^(#{1,3}\s+.+)$/m.exec(sec);
          const secTitle = headingMatch ? `MEMORY.md :: ${headingMatch[1].replace(/^#+\s*/, "").trim()}` : "MEMORY.md";
          const scored2 = scoreAndExtractSnippet(sec, secTitle, terms, projectTerms);
          if (scored2.score > 0) {
            hits.push({
              generation: gen,
              category: "handbook",
              relativePath: file.relativePath,
              title: secTitle,
              score: scored2.score + (gen === "v2" ? 2 : 0),
              snippet: scored2.snippet,
              mtimeMs: file.mtimeMs,
              sizeBytes: Buffer.byteLength(sec, "utf8")
            });
          }
        }
        continue;
      }
      const scored = scoreAndExtractSnippet(text, file.title, terms, projectTerms);
      if (scored.score > 0) {
        hits.push({
          generation: gen,
          category: file.category,
          relativePath: file.relativePath,
          title: file.title,
          score: scored.score + (gen === "v2" ? 3 : 0),
          snippet: scored.snippet,
          mtimeMs: file.mtimeMs,
          sizeBytes: file.sizeBytes
        });
      }
    }
  }
  hits.sort((a, b) => b.score - a.score || b.mtimeMs - a.mtimeMs);
  return hits.slice(0, limit);
}

// src/host/commands.ts
function tokenizeCommandInput(raw) {
  const tokens = [];
  let cur = "";
  let quote = null;
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
        cur = "";
      }
      continue;
    }
    cur += ch;
  }
  if (cur.length > 0) tokens.push(cur);
  return tokens;
}
async function handleMemoryCommand(runtime, invocation) {
  const tokens = tokenizeCommandInput(invocation.rawInput.trim());
  const sub = (tokens[0] ?? "status").toLowerCase();
  const cfg = runtime.getEffectiveConfig();
  const locale = runtime.resolveEffectiveLocale();
  const msg = getMessages(locale);
  const isZh = locale === "zh";
  const cwd = await runtime.resolveAgentCwd(invocation.agent, invocation.signal);
  if (!cwd) {
    return {
      kind: "error",
      text: isZh ? "\u65E0\u6CD5\u89E3\u6790\u5F53\u524D\u4F1A\u8BDD\u7684\u5DE5\u4F5C\u76EE\u5F55\u3002" : "Unable to resolve current session working directory."
    };
  }
  const sid = String(invocation.agent.id);
  const liveSnap = runtime.liveSessions.get(sid);
  if (sub === "status") {
    const res = resolveClaudeProject(cwd, {
      claudeConfigDir: runtime.claudeConfigDir,
      env: runtime.env
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
        liveSnap?.indexedConditionalRules.filter((r) => r.loaded).length ?? 0
      )}`
    ];
    return { kind: "success", text: lines.join("\n") };
  }
  if (sub === "list") {
    const res = resolveClaudeProject(cwd, {
      claudeConfigDir: runtime.claudeConfigDir,
      env: runtime.env
    });
    const topics = listTopicMemories(res.memoryDir);
    if (topics.length === 0) {
      return { kind: "success", text: msg.cmdNoTopics };
    }
    const header = isZh ? `## Claude \u81EA\u52A8\u8BB0\u5FC6\u5217\u8868\uFF08${topics.length} \u6761\uFF0Cslug=${res.slug}\uFF09` : `## Claude Auto Memory Topics (${topics.length}, slug=${res.slug})`;
    const items = topics.map(
      (t) => `- **${t.name}** [\`${t.type}\`] (\`${t.filename}\`): ${t.description}`
    );
    return { kind: "success", text: [header, ...items].join("\n") };
  }
  if (sub === "rules") {
    const hostSet = new Set(liveSnap?.hostLoadedPaths ?? []);
    const loaded = loadClaudeRulesForWorkspaces([cwd], {
      claudeConfigDir: runtime.claudeConfigDir,
      homeDir: runtime.homeDir,
      deduplicateNativeAgentsMd: cfg.deduplicateNativeAgentsMd,
      nativeRuleFilenames: DEFAULT_NATIVE_RULE_FILENAMES,
      hostName: DEFAULT_HOST_NAME,
      alreadyLoadedPaths: hostSet,
      trustClaudeCodeExternalApprovals: cfg.trustClaudeCodeExternalApprovals,
      externalRuleTrust: cfg.externalRuleTrust
    });
    const ws = loaded.workspaces[0];
    const lines = [
      isZh ? `## \u5DF2\u52A0\u8F7D\u89C4\u5219\u68C0\u67E5\uFF08${cwd}\uFF09` : `## Loaded Rules Inspection (${cwd})`
    ];
    const formatRule = (r) => {
      const badges = [r.scope];
      if (r.dedupedByHost) badges.push(isZh ? "\u5BBF\u4E3B\u5DF2\u52A0\u8F7D(\u53BB\u91CD)" : "host-deduped");
      if (r.imports.length > 0) badges.push(`@imports:${r.imports.length}`);
      if (r.paths && r.paths.length > 0) badges.push(`paths:${r.paths.join(",")}`);
      return `- \`${r.displayPath}\` [${badges.join(" | ")}]`;
    };
    const alwaysOn = [...loaded.globalAlwaysOn, ...ws?.alwaysOn ?? []];
    const conditional = [...loaded.globalConditional, ...ws?.conditional ?? []];
    lines.push(
      isZh ? `
### \u5E38\u9A7B\u89C4\u5219 (${alwaysOn.length})` : `
### Always-On Rules (${alwaysOn.length})`
    );
    lines.push(
      ...alwaysOn.length > 0 ? alwaysOn.map(formatRule) : [isZh ? "- \uFF08\u65E0\uFF09" : "- (none)"]
    );
    lines.push(
      isZh ? `
### \u6761\u4EF6\u89C4\u5219 paths: (${conditional.length})` : `
### Conditional paths: Rules (${conditional.length})`
    );
    lines.push(
      ...conditional.length > 0 ? conditional.map(formatRule) : [isZh ? "- \uFF08\u65E0\uFF09" : "- (none)"]
    );
    const pendingCount = ws?.blockedExternalTargets.filter((b) => b.status === "pending_approval").length ?? 0;
    if (pendingCount > 0) {
      lines.push(`
${msg.pendingExternalRuleNotice(pendingCount)}`);
    }
    return { kind: "success", text: lines.join("\n") };
  }
  if (sub === "trust") {
    const action = (tokens[1] ?? "list").toLowerCase();
    if (action === "allow" || action === "deny" || action === "revoke") {
      const targetPath = tokens.slice(2).join(" ").trim();
      if (!targetPath) {
        return {
          kind: "error",
          text: isZh ? `\u7528\u6CD5\uFF1A/memory trust ${action} <\u7EDD\u5BF9\u8DEF\u5F84>` : `Usage: /memory trust ${action} <target-path>`
        };
      }
      const updated = updateWorkspaceExternalTrust(cwd, action, targetPath, runtime.dataDir);
      return {
        kind: "success",
        text: isZh ? `\u5DF2\u66F4\u65B0\u5DE5\u4F5C\u533A\u5916\u90E8\u4FE1\u4EFB\u89C4\u5219\uFF08action=${action}\uFF0Ctarget=${targetPath}\uFF09\u3002\u5F53\u524D\u5141\u8BB8 ${updated.trust.allowPaths.length} \u9879\u3001\u62D2\u7EDD ${updated.trust.denyPaths.length} \u9879\u3002` : `Updated external trust (action=${action}, target=${targetPath}). Active allowlist: ${updated.trust.allowPaths.length}, denylist: ${updated.trust.denyPaths.length}.`
      };
    }
    if (action === "clear") {
      updateWorkspaceExternalTrust(cwd, "clear_workspace", void 0, runtime.dataDir);
      return {
        kind: "success",
        text: isZh ? `\u5DF2\u6E05\u7A7A\u5DE5\u4F5C\u533A ${cwd} \u7684\u5168\u90E8\u5916\u90E8\u4FE1\u4EFB\u8986\u76D6\u89C4\u5219\u3002` : `Cleared all external trust overrides for workspace ${cwd}.`
      };
    }
    const loaded = loadClaudeRulesForWorkspaces([cwd], {
      claudeConfigDir: runtime.claudeConfigDir,
      homeDir: runtime.homeDir,
      deduplicateNativeAgentsMd: cfg.deduplicateNativeAgentsMd,
      nativeRuleFilenames: DEFAULT_NATIVE_RULE_FILENAMES,
      hostName: DEFAULT_HOST_NAME,
      trustClaudeCodeExternalApprovals: cfg.trustClaudeCodeExternalApprovals,
      externalRuleTrust: cfg.externalRuleTrust
    });
    const ws = loaded.workspaces[0];
    const trust = getWorkspaceExternalTrust(cfg.externalRuleTrust, cwd);
    const blocked = ws?.blockedExternalTargets ?? [];
    if (blocked.length === 0 && trust.allowPaths.length === 0 && trust.denyPaths.length === 0) {
      return { kind: "success", text: msg.cmdNoExternalPending };
    }
    const lines = [
      isZh ? `## \u5916\u90E8\u89C4\u5219\u4FE1\u4EFB\u8FB9\u754C\uFF08${cwd}\uFF09` : `## External Rule Trust (${cwd})`,
      isZh ? `- \u5141\u8BB8\u5217\u8868 (${trust.allowPaths.length}): ${trust.allowPaths.join(", ") || "\uFF08\u65E0\uFF09"}` : `- Allowlist (${trust.allowPaths.length}): ${trust.allowPaths.join(", ") || "(none)"}`,
      isZh ? `- \u62D2\u7EDD\u5217\u8868 (${trust.denyPaths.length}): ${trust.denyPaths.join(", ") || "\uFF08\u65E0\uFF09"}` : `- Denylist (${trust.denyPaths.length}): ${trust.denyPaths.join(", ") || "(none)"}`
    ];
    if (blocked.length > 0) {
      lines.push(isZh ? "\n### \u5DF2\u62E6\u622A\u7684\u5916\u90E8\u76EE\u6807" : "\n### Blocked External Targets");
      for (const b of blocked) {
        lines.push(
          isZh ? `- [${b.status}] \`${b.resolvedTarget}\`\uFF08\u6765\u6E90\uFF1A\`${b.sourceDisplayPath}\`\uFF09` : `- [${b.status}] \`${b.resolvedTarget}\` (from \`${b.sourceDisplayPath}\`)`
        );
      }
      lines.push(
        isZh ? "\n\u53EF\u6267\u884C `/memory trust allow <\u8DEF\u5F84>` \u6216 `/memory trust deny <\u8DEF\u5F84>` \u8FDB\u884C\u7BA1\u7406\u3002" : "\nRun `/memory trust allow <path>` or `/memory trust deny <path>` to update."
      );
    }
    return { kind: "success", text: lines.join("\n") };
  }
  if (sub === "reload") {
    runtime.pendingReloadSessions.add(sid);
    return { kind: "success", text: msg.cmdReloadNotice };
  }
  return { kind: "error", text: msg.cmdUsageHint };
}
function registerSlashCommands(ctx, runtime) {
  ctx.inject(["commands"], (c) => {
    c.effect(
      () => c.commands.register({
        name: "memory",
        description: "Inspect or manage Unified Memory (status | list | rules | trust | reload) | \u67E5\u770B\u6216\u7BA1\u7406\u7EDF\u4E00\u8BB0\u5FC6\u4E0E\u89C4\u5219",
        input: { hint: "[status | list | rules | trust | reload]" },
        handler: (invocation) => handleMemoryCommand(runtime, invocation)
      })
    );
  });
}

// src/host/context.ts
import fs6 from "node:fs";
import path6 from "node:path";
import { performance } from "node:perf_hooks";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
var UNIFIED_MEMORY_SOURCE_KIND = "unified-memory";
function escapeSystemReminder(text) {
  return text.replace(/<\/system-reminder>/gi, "<\\/system-reminder>");
}
function wrapSystemReminder(text) {
  return `<system-reminder>
${escapeSystemReminder(text)}
</system-reminder>`;
}
function clampUtf8(text, maxBytes) {
  const total = Buffer.byteLength(text, "utf8");
  if (total <= maxBytes) return { content: text, truncated: false };
  const lines = text.split("\n");
  const out = [];
  let used = 0;
  for (let i = 0; i < lines.length; i++) {
    const b = Buffer.byteLength(lines[i], "utf8") + (i > 0 ? 1 : 0);
    if (used + b > maxBytes) break;
    out.push(lines[i]);
    used += b;
  }
  return { content: out.join("\n"), truncated: true };
}
function resolveChangePath(rawPath, baseDir, homeDir) {
  const trimmed = rawPath.trim();
  if (!trimmed) return null;
  if (trimmed === "~") {
    return path6.resolve(homeDir);
  }
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return path6.resolve(path6.join(homeDir, trimmed.slice(2)));
  }
  if (path6.isAbsolute(trimmed)) {
    return path6.resolve(trimmed);
  }
  if (baseDir) {
    return path6.resolve(baseDir, trimmed);
  }
  return null;
}
function resolveBaseDirFromIdentity(baselineIdentity, fallbackCwd) {
  if (baselineIdentity) {
    try {
      const parsed = JSON.parse(baselineIdentity);
      if (typeof parsed.projectRoot === "string") {
        const rawRoot = parsed.projectRoot.trim();
        if (path6.isAbsolute(rawRoot)) {
          return path6.resolve(rawRoot);
        }
        if (fallbackCwd) {
          return path6.resolve(fallbackCwd, rawRoot);
        }
      }
    } catch {
    }
  }
  if (fallbackCwd) {
    const gitTop = resolveGitTopLevel(fallbackCwd);
    return gitTop ? path6.resolve(gitTop) : path6.resolve(fallbackCwd);
  }
  return null;
}
function extractHostLoadedPaths(agent, decisionMessages, fallbackCwd, homeDir) {
  const activeByScope = /* @__PURE__ */ new Map();
  let active = false;
  let lastBaseDir = resolveBaseDirFromIdentity(void 0, fallbackCwd);
  const foldSource = (rawSource) => {
    if (!rawSource || typeof rawSource !== "object") return;
    const src = rawSource;
    if (src.kind !== "agent-instructions") return;
    active = true;
    const candidateBase = resolveBaseDirFromIdentity(src.baselineIdentity, fallbackCwd);
    if (candidateBase) lastBaseDir = candidateBase;
    if (!Array.isArray(src.changes)) return;
    for (const ch of src.changes) {
      if (!ch || typeof ch !== "object") continue;
      const scopeKey = typeof ch.scope === "string" && ch.scope ? ch.scope : ch.path;
      if (!scopeKey) continue;
      if (ch.action === "remove") {
        activeByScope.delete(scopeKey);
      } else if (typeof ch.path === "string") {
        const abs = resolveChangePath(ch.path, lastBaseDir, homeDir);
        if (abs) activeByScope.set(scopeKey, abs);
      }
    }
  };
  for (const seq of agent.session.surface.nodes) {
    const ev = agent.session.eventAt(seq);
    if (ev?.type === "user/message") {
      foldSource(ev.data.source);
    }
  }
  for (const msg of decisionMessages) {
    foldSource(msg.source);
  }
  return { active, paths: new Set(activeByScope.values()) };
}
function findVisibleBaselineSource(agent, decisionMessages) {
  for (let i = decisionMessages.length - 1; i >= 0; i--) {
    const src = decisionMessages[i].source;
    if (src?.kind === UNIFIED_MEMORY_SOURCE_KIND && src.baseline === true) {
      return src;
    }
  }
  const nodes = agent.session.surface.nodes;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const ev = agent.session.eventAt(nodes[i]);
    if (ev?.type === "user/message") {
      const src = ev.data.source;
      if (src?.kind === UNIFIED_MEMORY_SOURCE_KIND && src.baseline === true) {
        return src;
      }
    }
  }
  return void 0;
}
function extractFilePathsFromExecution(exec) {
  const args = exec.arguments;
  if (!args || typeof args !== "object") return [];
  const rec = args;
  if (exec.name === "read" || exec.name === "read_image" || exec.name === "write" || exec.name === "edit") {
    if (typeof rec.file_path === "string" && rec.file_path.trim().length > 0) {
      return [rec.file_path.trim()];
    }
    return [];
  }
  if (exec.name === "str_replace_editor") {
    if (typeof rec.path === "string" && rec.path.trim().length > 0) {
      return [rec.path.trim()];
    }
    return [];
  }
  if (exec.name === "apply_patch") {
    const input = typeof rec.input === "string" ? rec.input : "";
    if (!input) return [];
    const found = /* @__PURE__ */ new Set();
    const rx = /^\*\*\*\s+(?:(?:Add|Update|Delete)\s+File|Move to):\s*(.+)$/gm;
    let m;
    while ((m = rx.exec(input)) !== null) {
      const p = m[1]?.trim();
      if (p) found.add(p);
    }
    return Array.from(found);
  }
  return [];
}
function buildBaselineInjection(cwd, config, runtime, locale, hostLoadedPaths, reason) {
  const msg = getMessages(locale);
  const rulesLoaded = loadClaudeRulesForWorkspaces([cwd], {
    claudeConfigDir: runtime.claudeConfigDir,
    homeDir: runtime.homeDir,
    deduplicateNativeAgentsMd: config.deduplicateNativeAgentsMd,
    nativeRuleFilenames: DEFAULT_NATIVE_RULE_FILENAMES,
    hostName: DEFAULT_HOST_NAME,
    alreadyLoadedPaths: hostLoadedPaths,
    trustClaudeCodeExternalApprovals: config.trustClaudeCodeExternalApprovals,
    externalRuleTrust: config.externalRuleTrust
  });
  const sections = [];
  const labels = [];
  const fileMtimes = {};
  const indexedConditionalRules = [];
  const loadedAlwaysOnRules = [];
  let pendingExternalApprovalCount = 0;
  sections.push(
    reason === "compaction_reload" ? msg.baselineHeaderCompactionReload : msg.baselineHeaderSessionStart
  );
  const renderRuleEntry = (r) => {
    fileMtimes[r.filePath] = r.mtimeMs;
    loadedAlwaysOnRules.push({
      displayPath: r.displayPath,
      filePath: r.filePath,
      scope: r.scope,
      dedupedByHost: r.dedupedByHost,
      importsCount: r.imports.length
    });
    if (r.dedupedByHost) {
      if (r.importedOnlyContent.trim().length === 0) {
        return null;
      }
      labels.push(`${r.scope}:imports-only:${r.displayPath}`);
      return `### ${msg.hostDedupedImportOnlySubtitle(r.displayPath)}
${r.importedOnlyContent}`;
    }
    labels.push(`${r.scope}:${r.displayPath}`);
    return `### ${r.displayPath} (${r.scope})
${r.content}`;
  };
  if (rulesLoaded.globalAlwaysOn.length > 0) {
    const blocks = [];
    for (const r of rulesLoaded.globalAlwaysOn) {
      const rendered = renderRuleEntry(r);
      if (rendered) blocks.push(rendered);
    }
    if (blocks.length > 0) {
      sections.push(`${msg.sectionGlobalClaudeInstructions}
${blocks.join("\n\n")}`);
    }
  }
  for (const gc of rulesLoaded.globalConditional) {
    indexedConditionalRules.push({
      id: `${gc.id}::${cwd}`,
      filePath: gc.filePath,
      displayPath: gc.displayPath,
      workspaceRoot: cwd,
      paths: gc.paths ?? [],
      scope: gc.scope
    });
  }
  let resolvedProjectRoot = null;
  let claudeSlug = null;
  let claudeMemoryIndex = null;
  for (const wsBundle of rulesLoaded.workspaces) {
    const wsName = path6.basename(wsBundle.workspaceRoot) || wsBundle.workspaceRoot;
    const dormantConditionalFiles = new Set(wsBundle.conditional.map((c) => c.filePath));
    const wsPendingExternal = wsBundle.blockedExternalTargets.filter(
      (b) => b.status === "pending_approval" && !dormantConditionalFiles.has(b.sourceFile)
    ).length;
    pendingExternalApprovalCount += wsPendingExternal;
    const blocks = [];
    for (const r of wsBundle.alwaysOn) {
      const rendered = renderRuleEntry(r);
      if (rendered) blocks.push(rendered);
    }
    if (wsPendingExternal > 0) {
      labels.push(`blocked-external:${wsName}:${wsPendingExternal}`);
      blocks.push(msg.pendingExternalRuleNotice(wsPendingExternal));
    }
    if (blocks.length > 0) {
      sections.push(
        `${msg.sectionProjectClaudeInstructions(wsName, wsBundle.workspaceRoot)}
${blocks.join("\n\n")}`
      );
    }
    for (const cond of wsBundle.conditional) {
      indexedConditionalRules.push({
        id: cond.id,
        filePath: cond.filePath,
        displayPath: cond.displayPath,
        workspaceRoot: wsBundle.workspaceRoot,
        paths: cond.paths ?? [],
        scope: cond.scope
      });
    }
    const resolution = resolveClaudeProject(wsBundle.workspaceRoot, {
      claudeConfigDir: runtime.claudeConfigDir,
      env: runtime.env
    });
    resolvedProjectRoot = resolution.resolvedRoot;
    claudeSlug = resolution.slug;
    if (resolution.autoMemoryEnabled) {
      const memIndex = readMemoryIndex(resolution.memoryDir);
      const topics = listTopicMemories(resolution.memoryDir);
      claudeMemoryIndex = {
        exists: memIndex.exists,
        totalLines: memIndex.totalLines,
        maxLines: memIndex.maxLines,
        totalBytes: memIndex.totalBytes,
        maxBytes: memIndex.maxBytes,
        truncated: memIndex.truncated,
        topicCount: topics.length
      };
      if (memIndex.exists && memIndex.truncatedContent.trim()) {
        fileMtimes[memIndex.filePath] = memIndex.mtimeMs;
        labels.push(`claude-memory:${resolution.slug}`);
        const truncNote = memIndex.truncated ? `
${msg.claudeMemoryTruncatedNote(
          memIndex.includedLines,
          memIndex.totalLines,
          (memIndex.includedBytes / 1024).toFixed(1),
          (memIndex.totalBytes / 1024).toFixed(1)
        )}` : "";
        sections.push(
          `${msg.sectionClaudeMemoryIndex(wsName)}
${msg.claudeMemoryCanonicalDirLine(resolution.memoryDir, resolution.slug, resolution.isGitWorktree)}
${msg.claudeMemoryToolsHintLine}

${memIndex.truncatedContent}${truncNote}`
        );
      } else {
        sections.push(
          `${msg.sectionClaudeMemoryEmpty(wsName)}
${msg.claudeMemoryEmptyLine(resolution.memoryDir)}`
        );
      }
    }
  }
  let codexSummaryInjected = false;
  if (config.injectCodexSummaryOnStart) {
    const codexSummary = readCodexSummary({
      codexHome: runtime.codexHome,
      generation: "auto",
      maxBytes: config.codexSummaryMaxBytes
    });
    if (codexSummary.generation !== "none" && codexSummary.content.trim()) {
      codexSummaryInjected = true;
      if (codexSummary.filePath) {
        fileMtimes[codexSummary.filePath] = codexSummary.mtimeMs;
      }
      labels.push(`codex-${codexSummary.generation}:memory_summary.md`);
      const truncNote = codexSummary.truncated ? `
${msg.codexSummaryTruncatedNote((config.codexSummaryMaxBytes / 1024).toFixed(1))}` : "";
      sections.push(
        `${msg.sectionCodexSummary(codexSummary.generation)}
${msg.codexReadOnlyNoticeLine}

${codexSummary.content}${truncNote}`
      );
    }
  }
  if (config.injectCodexGlobalAgentsMd) {
    const codexAgents = readCodexGlobalAgentsMd(runtime.codexHome);
    if (codexAgents && codexAgents.content) {
      const filename = codexAgents.isOverride ? "AGENTS.override.md" : "AGENTS.md";
      labels.push(`codex:${filename}`);
      sections.push(`${msg.sectionCodexGlobalAgents(filename)}
${codexAgents.content}`);
    }
  }
  if (sections.length <= 1) {
    return {
      text: "",
      labels,
      indexedConditionalRules,
      loadedAlwaysOnRules,
      pendingExternalApprovalCount,
      fileMtimes,
      resolvedProjectRoot,
      claudeSlug,
      claudeMemoryIndex,
      codexSummaryInjected
    };
  }
  const joined = sections.join("\n\n---\n\n");
  const clamped = clampUtf8(joined, config.maxStartupInjectBytes);
  const finalText = clamped.truncated ? `${clamped.content}

${msg.startupContextTruncatedNote((config.maxStartupInjectBytes / 1024).toFixed(0))}` : clamped.content;
  return {
    text: finalText,
    labels,
    indexedConditionalRules,
    loadedAlwaysOnRules,
    pendingExternalApprovalCount,
    fileMtimes,
    resolvedProjectRoot,
    claudeSlug,
    claudeMemoryIndex,
    codexSummaryInjected
  };
}
function registerContextLifecycle(ctx, runtime) {
  const executionTouches = /* @__PURE__ */ new Map();
  const stepTouches = /* @__PURE__ */ new WeakMap();
  const committedTouches = /* @__PURE__ */ new WeakMap();
  const ruleTriggersBySession = /* @__PURE__ */ new Map();
  const subdirRecordsBySession = /* @__PURE__ */ new Map();
  ctx.effect(() => () => {
    executionTouches.clear();
    ruleTriggersBySession.clear();
    subdirRecordsBySession.clear();
  });
  ctx.on("agent/disposed", ({ agent }) => {
    const sid = String(agent.id);
    ruleTriggersBySession.delete(sid);
    subdirRecordsBySession.delete(sid);
  });
  const stepIsOpen = (session) => {
    try {
      const boundary = ctx.agents.turnBoundaryOf(session);
      return boundary.openTurnStartSeq !== null && boundary.lastStepBoundary?.kind === "start" && boundary.lastStepBoundary.seq > boundary.openTurnStartSeq;
    } catch {
      return false;
    }
  };
  const commitTouch = (touch) => {
    const sess = touch.agent.session;
    const list = committedTouches.get(sess);
    if (list) list.push(touch);
    else committedTouches.set(sess, [touch]);
  };
  const scheduleTouch = (touch) => {
    const sess = touch.agent.session;
    if (!stepIsOpen(sess)) {
      commitTouch(touch);
      return;
    }
    const list = stepTouches.get(sess);
    if (list) list.push(touch);
    else stepTouches.set(sess, [touch]);
  };
  ctx.on("session/event", (session, event) => {
    if (event.type !== "step/end") return;
    const pending = stepTouches.get(session);
    if (!pending) return;
    stepTouches.delete(session);
    for (const touch of pending) {
      commitTouch(touch);
    }
  });
  ctx.on("tools/result", (exec, result) => {
    const collected = executionTouches.get(exec.token) ?? [];
    executionTouches.delete(exec.token);
    if (!result.isError && exec.agent !== void 0 && !exec.signal.aborted) {
      const touchedPaths = extractFilePathsFromExecution(exec);
      for (const filePath of touchedPaths) {
        collected.push({ agent: exec.agent, filePath, toolName: exec.name });
      }
    }
    if (exec.parent !== void 0) {
      if (collected.length > 0) {
        const parentList = executionTouches.get(exec.parent);
        if (parentList) parentList.push(...collected);
        else executionTouches.set(exec.parent, collected);
      }
      return;
    }
    for (const touch of collected) {
      scheduleTouch(touch);
    }
  });
  const hydrateLiveSnapshot = (agent, state, locale, hostActive, hostPaths, opts) => {
    const sid = String(agent.id);
    const prev = runtime.liveSessions.get(sid);
    const triggers = ruleTriggersBySession.get(sid);
    const loadedRuleSet = new Set(state.loadedRuleKeys);
    const indexedConditionalRules = state.indexedConditionalRules.map((r) => ({
      id: r.id,
      displayPath: r.displayPath,
      filePath: r.filePath,
      paths: r.paths,
      scope: r.scope,
      loaded: loadedRuleSet.has(r.id),
      triggeredBy: triggers?.get(r.id)
    }));
    const subdirMap = subdirRecordsBySession.get(sid);
    const loadedSubdirClaudeMds = subdirMap ? Array.from(subdirMap.values()) : state.loadedSubdirPaths.map((k) => ({
      displayPath: path6.basename(k),
      filePath: k,
      triggeredBy: ""
    }));
    runtime.liveSessions.set(sid, {
      sessionId: sid,
      cwd: state.lastBaselineCwd ?? state.workspacePaths[0] ?? null,
      resolvedProjectRoot: opts.resolvedProjectRoot ?? prev?.resolvedProjectRoot ?? null,
      claudeSlug: opts.claudeSlug ?? prev?.claudeSlug ?? null,
      resolvedLocale: locale,
      origin: agent.session.header.origin === "subagent" ? "subagent" : "root",
      isSeeded: Boolean(agent.session.header.isSeeded),
      baselineInjected: opts.baselineInjected,
      baselineInjectedAt: opts.baselineInjectedAt !== void 0 ? opts.baselineInjectedAt : prev?.baselineInjectedAt ?? null,
      baselineBytes: opts.baselineBytes ?? prev?.baselineBytes ?? 0,
      replaceGeneration: agent.session.surface.replaceGeneration,
      compactionCount: state.compactionCount,
      hostAgentInstructionsActive: hostActive || (prev?.hostAgentInstructionsActive ?? false),
      hostLoadedPaths: Array.from(hostPaths).sort(),
      injectedLabels: opts.injectedLabels ?? prev?.injectedLabels ?? [],
      loadedAlwaysOnRules: opts.loadedAlwaysOnRules ?? prev?.loadedAlwaysOnRules ?? [],
      indexedConditionalRules,
      loadedSubdirClaudeMds,
      pendingExternalApprovalCount: opts.pendingExternalApprovalCount ?? prev?.pendingExternalApprovalCount ?? 0,
      claudeMemoryIndex: opts.claudeMemoryIndex !== void 0 ? opts.claudeMemoryIndex : prev?.claudeMemoryIndex ?? null,
      codexSummaryInjected: opts.codexSummaryInjected ?? prev?.codexSummaryInjected ?? false,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  };
  ctx.on(
    "agent/pre-step",
    async ({ agent, messages, step, signal }, next) => {
      const t0 = performance.now();
      const decision = await next();
      if (decision.kind !== "enter") return decision;
      if (step === 1 && decision.messages.length === 0) return decision;
      if (signal.aborted) return decision;
      const sessionId = String(agent.id);
      const cwd = await runtime.resolveAgentCwd(agent, signal);
      if (!cwd) return decision;
      const config = runtime.getEffectiveConfig();
      const hostInfo = extractHostLoadedPaths(agent, decision.messages, cwd, runtime.homeDir);
      const visibleBaseline = findVisibleBaselineSource(agent, decision.messages);
      const replaceGeneration = agent.session.surface.replaceGeneration;
      let state = loadSessionState(sessionId, runtime.dataDir);
      const isFreshState = state === null;
      if (!state) {
        gcStaleSessions(runtime.dataDir);
        state = createEmptySessionState(sessionId, [cwd]);
      }
      const forcedReload = runtime.pendingReloadSessions.delete(sessionId);
      const cwdChanged = visibleBaseline !== void 0 && visibleBaseline.cwd !== void 0 && path6.resolve(visibleBaseline.cwd) !== path6.resolve(cwd);
      const emptyBaselineAlreadyEvaluated = visibleBaseline === void 0 && state.sessionStarted && state.lastBaselineCwd !== void 0 && path6.resolve(state.lastBaselineCwd) === path6.resolve(cwd) && state.lastReplaceGeneration === replaceGeneration;
      const isCompactionReload = visibleBaseline === void 0 && !emptyBaselineAlreadyEvaluated && (replaceGeneration > 0 || state.sessionStarted && replaceGeneration > (state.lastReplaceGeneration ?? 0));
      const needsBaseline = forcedReload || cwdChanged || visibleBaseline === void 0 && !emptyBaselineAlreadyEvaluated;
      const sessionLocale = needsBaseline ? runtime.resolveEffectiveLocale() : visibleBaseline?.locale ?? state.locale ?? runtime.resolveEffectiveLocale();
      const injectedMessages = [];
      let stateDirty = isFreshState;
      const hostPathsSorted = Array.from(hostInfo.paths).sort();
      if (JSON.stringify(state.hostDedupedPaths ?? []) !== JSON.stringify(hostPathsSorted)) {
        state.hostDedupedPaths = hostPathsSorted;
        stateDirty = true;
      }
      if (needsBaseline) {
        const reason = isCompactionReload ? "compaction_reload" : "session_start";
        const baseline = buildBaselineInjection(
          cwd,
          config,
          runtime,
          sessionLocale,
          hostInfo.paths,
          reason
        );
        state.sessionStarted = true;
        state.locale = sessionLocale;
        state.workspacePaths = [cwd];
        state.lastBaselineCwd = cwd;
        state.lastReplaceGeneration = replaceGeneration;
        state.indexedConditionalRules = baseline.indexedConditionalRules;
        state.fileMtimes = baseline.fileMtimes;
        if (isCompactionReload || forcedReload || cwdChanged) {
          if (isCompactionReload) state.compactionCount += 1;
          state.loadedRuleKeys = [];
          state.loadedSubdirPaths = [];
          ruleTriggersBySession.delete(sessionId);
          subdirRecordsBySession.delete(sessionId);
        }
        stateDirty = true;
        const nowIso = (/* @__PURE__ */ new Date()).toISOString();
        let baselineBytes = 0;
        if (baseline.text) {
          const wrapped = wrapSystemReminder(baseline.text);
          baselineBytes = Buffer.byteLength(wrapped, "utf8");
          const baselineSource = {
            kind: UNIFIED_MEMORY_SOURCE_KIND,
            form: "instructions",
            baseline: true,
            cwd,
            locale: sessionLocale,
            replaceGeneration
          };
          injectedMessages.push(
            createUserMessage({
              content: [{ type: "text", text: wrapped }],
              source: baselineSource
            })
          );
        }
        hydrateLiveSnapshot(agent, state, sessionLocale, hostInfo.active, hostInfo.paths, {
          baselineInjected: baseline.text.length > 0,
          baselineInjectedAt: baseline.text.length > 0 ? nowIso : null,
          baselineBytes,
          injectedLabels: baseline.labels,
          loadedAlwaysOnRules: baseline.loadedAlwaysOnRules,
          pendingExternalApprovalCount: baseline.pendingExternalApprovalCount,
          resolvedProjectRoot: baseline.resolvedProjectRoot,
          claudeSlug: baseline.claudeSlug,
          claudeMemoryIndex: baseline.claudeMemoryIndex,
          codexSummaryInjected: baseline.codexSummaryInjected
        });
        appendDiagnosticEvent(
          {
            ts: nowIso,
            event: isCompactionReload ? "CompactionReload" : forcedReload ? "ManualReload" : "BaselineInject",
            conversationId: sessionId,
            elapsedMs: Number((performance.now() - t0).toFixed(2)),
            workspacePaths: [cwd],
            cwd,
            locale: sessionLocale,
            hostDedupedCount: hostPathsSorted.length,
            injectedCount: baseline.text ? 1 : 0,
            injectedLabels: baseline.labels,
            compactionReload: isCompactionReload || void 0
          },
          runtime.dataDir
        );
      } else if (!runtime.liveSessions.has(sessionId)) {
        if (!state.sessionStarted) {
          state.sessionStarted = true;
          state.locale = sessionLocale;
          state.workspacePaths = [cwd];
          state.lastBaselineCwd = visibleBaseline?.cwd ?? cwd;
          state.lastReplaceGeneration = replaceGeneration;
          const rulesOnly = loadClaudeRulesForWorkspaces([cwd], {
            claudeConfigDir: runtime.claudeConfigDir,
            homeDir: runtime.homeDir,
            deduplicateNativeAgentsMd: config.deduplicateNativeAgentsMd,
            nativeRuleFilenames: DEFAULT_NATIVE_RULE_FILENAMES,
            hostName: DEFAULT_HOST_NAME,
            alreadyLoadedPaths: hostInfo.paths,
            trustClaudeCodeExternalApprovals: config.trustClaudeCodeExternalApprovals,
            externalRuleTrust: config.externalRuleTrust
          });
          state.indexedConditionalRules = [
            ...rulesOnly.globalConditional.map((gc) => ({
              id: `${gc.id}::${cwd}`,
              filePath: gc.filePath,
              displayPath: gc.displayPath,
              workspaceRoot: cwd,
              paths: gc.paths ?? [],
              scope: gc.scope
            })),
            ...rulesOnly.workspaces.flatMap(
              (ws) => ws.conditional.map((c) => ({
                id: c.id,
                filePath: c.filePath,
                displayPath: c.displayPath,
                workspaceRoot: ws.workspaceRoot,
                paths: c.paths ?? [],
                scope: c.scope
              }))
            )
          ];
          stateDirty = true;
        }
        const resolution = resolveClaudeProject(cwd, {
          claudeConfigDir: runtime.claudeConfigDir,
          env: runtime.env
        });
        const memIndex = resolution.autoMemoryEnabled ? readMemoryIndex(resolution.memoryDir) : null;
        const topics = resolution.autoMemoryEnabled ? listTopicMemories(resolution.memoryDir) : [];
        hydrateLiveSnapshot(agent, state, sessionLocale, hostInfo.active, hostInfo.paths, {
          baselineInjected: visibleBaseline !== void 0,
          resolvedProjectRoot: resolution.resolvedRoot,
          claudeSlug: resolution.slug,
          claudeMemoryIndex: memIndex ? {
            exists: memIndex.exists,
            totalLines: memIndex.totalLines,
            maxLines: memIndex.maxLines,
            totalBytes: memIndex.totalBytes,
            maxBytes: memIndex.maxBytes,
            truncated: memIndex.truncated,
            topicCount: topics.length
          } : null
        });
      }
      const touches = committedTouches.get(agent.session);
      if (touches && touches.length > 0) {
        committedTouches.delete(agent.session);
        const msg = getMessages(sessionLocale);
        const loadedRules = new Set(state.loadedRuleKeys);
        const loadedSubdirs = new Set(state.loadedSubdirPaths);
        const lazyBlocks = [];
        const lazyLabels = [];
        let lastToolName;
        let lastTriggeredPath;
        let triggerMap = ruleTriggersBySession.get(sessionId);
        if (!triggerMap) {
          triggerMap = /* @__PURE__ */ new Map();
          ruleTriggersBySession.set(sessionId, triggerMap);
        }
        let subdirMap = subdirRecordsBySession.get(sessionId);
        if (!subdirMap) {
          subdirMap = /* @__PURE__ */ new Map();
          subdirRecordsBySession.set(sessionId, subdirMap);
        }
        const dedupTrustOpts = {
          claudeConfigDir: runtime.claudeConfigDir,
          homeDir: runtime.homeDir,
          deduplicateNativeAgentsMd: config.deduplicateNativeAgentsMd,
          nativeRuleFilenames: DEFAULT_NATIVE_RULE_FILENAMES,
          hostName: DEFAULT_HOST_NAME,
          alreadyLoadedPaths: hostInfo.paths,
          trustClaudeCodeExternalApprovals: config.trustClaudeCodeExternalApprovals,
          externalRuleTrust: config.externalRuleTrust
        };
        for (const touch of touches) {
          const accessedAbs = path6.isAbsolute(touch.filePath) ? path6.resolve(touch.filePath) : path6.resolve(cwd, touch.filePath);
          lastToolName = touch.toolName;
          lastTriggeredPath = accessedAbs;
          for (const rule of state.indexedConditionalRules) {
            if (loadedRules.has(rule.id)) continue;
            const wsRoot = path6.resolve(rule.workspaceRoot);
            if (accessedAbs !== wsRoot && !accessedAbs.startsWith(wsRoot + path6.sep)) continue;
            const relPath = path6.relative(wsRoot, accessedAbs).replace(/\\/g, "/");
            if (!matchesGlobPatterns(relPath, rule.paths)) continue;
            loadedRules.add(rule.id);
            triggerMap.set(rule.id, relPath);
            stateDirty = true;
            const res = loadConditionalRuleContentWithDiagnostics(
              rule.filePath,
              wsRoot,
              rule.scope,
              dedupTrustOpts
            );
            const pendingCount = res.blocked.filter((b) => b.status === "pending_approval").length;
            const subtitle = msg.scopedRuleMatchedSubtitle(rule.displayPath, relPath);
            if (res.entry) {
              const note = pendingCount > 0 ? `

${msg.pendingExternalRuleNotice(pendingCount)}` : "";
              lazyBlocks.push(`### ${subtitle}
${res.entry.content}${note}`);
              lazyLabels.push(`lazy-rule:${rule.displayPath}`);
            } else if (pendingCount > 0) {
              lazyBlocks.push(`### ${subtitle}
${msg.pendingExternalRuleNotice(pendingCount)}`);
              lazyLabels.push(`lazy-blocked-rule:${rule.displayPath}`);
            }
          }
          const absWs = path6.resolve(cwd);
          if (accessedAbs === absWs || accessedAbs.startsWith(absWs + path6.sep)) {
            const relTriggered = path6.relative(absWs, accessedAbs).replace(/\\/g, "/");
            const subRes = findSubdirectoryClaudeMdsWithDiagnostics(
              accessedAbs,
              absWs,
              dedupTrustOpts
            );
            const seenFiles = /* @__PURE__ */ new Set();
            for (const sub of subRes.entries) {
              seenFiles.add(sub.filePath);
              if (loadedSubdirs.has(sub.id)) continue;
              loadedSubdirs.add(sub.id);
              subdirMap.set(sub.id, {
                displayPath: sub.displayPath,
                filePath: sub.filePath,
                triggeredBy: relTriggered
              });
              stateDirty = true;
              const pendingCount = sub.blockedExternalTargets.filter(
                (b) => b.status === "pending_approval"
              ).length;
              const note = pendingCount > 0 ? `

${msg.pendingExternalRuleNotice(pendingCount)}` : "";
              if (sub.dedupedByHost) {
                if (sub.importedOnlyContent.trim().length > 0) {
                  lazyBlocks.push(
                    `### ${msg.hostDedupedImportOnlySubtitle(sub.displayPath)}
${sub.importedOnlyContent}${note}`
                  );
                  lazyLabels.push(`lazy-subdir-imports:${sub.displayPath}`);
                } else if (pendingCount > 0) {
                  lazyBlocks.push(
                    `### ${msg.subdirClaudeMdTriggeredSubtitle(sub.displayPath, relTriggered)}
${msg.pendingExternalRuleNotice(pendingCount)}`
                  );
                  lazyLabels.push(`lazy-blocked-subdir:${sub.displayPath}`);
                }
              } else {
                lazyBlocks.push(
                  `### ${msg.subdirClaudeMdTriggeredSubtitle(sub.displayPath, relTriggered)}
${sub.content}${note}`
                );
                lazyLabels.push(`lazy-subdir:${sub.displayPath}`);
              }
            }
            for (const blk of subRes.blocked) {
              if (blk.status !== "pending_approval") continue;
              if (seenFiles.has(blk.sourceFile)) continue;
              const blockedKey = `blocked:${blk.sourceFile}`;
              if (loadedSubdirs.has(blockedKey)) continue;
              loadedSubdirs.add(blockedKey);
              stateDirty = true;
              lazyBlocks.push(
                `### ${msg.subdirClaudeMdTriggeredSubtitle(blk.sourceDisplayPath, relTriggered)}
${msg.pendingExternalRuleNotice(1)}`
              );
              lazyLabels.push(`lazy-blocked-subdir:${blk.sourceDisplayPath}`);
            }
          }
        }
        state.loadedRuleKeys = Array.from(loadedRules);
        state.loadedSubdirPaths = Array.from(loadedSubdirs);
        if (lazyBlocks.length > 0) {
          const lazyText = `${msg.lazyHeaderScopedRules}

${lazyBlocks.join("\n\n---\n\n")}`;
          const lazySource = {
            kind: UNIFIED_MEMORY_SOURCE_KIND,
            form: "recall",
            lazy: true,
            cwd,
            locale: sessionLocale
          };
          injectedMessages.push(
            createUserMessage({
              content: [{ type: "text", text: wrapSystemReminder(lazyText) }],
              source: lazySource
            })
          );
          appendDiagnosticEvent(
            {
              ts: (/* @__PURE__ */ new Date()).toISOString(),
              event: "LazyRuleInject",
              conversationId: sessionId,
              elapsedMs: Number((performance.now() - t0).toFixed(2)),
              workspacePaths: [cwd],
              cwd,
              locale: sessionLocale,
              hostDedupedCount: hostPathsSorted.length,
              injectedCount: lazyBlocks.length,
              injectedLabels: lazyLabels,
              toolName: lastToolName,
              triggeredBy: lastTriggeredPath
            },
            runtime.dataDir
          );
        }
        if (stateDirty) {
          hydrateLiveSnapshot(agent, state, sessionLocale, hostInfo.active, hostInfo.paths, {
            baselineInjected: runtime.liveSessions.get(sessionId)?.baselineInjected ?? true
          });
        }
      }
      if (stateDirty) {
        try {
          saveSessionState(state, runtime.dataDir);
        } catch (err) {
          ctx.logger.warn("unified-memory: failed to save session state: %o", err);
        }
      }
      if (injectedMessages.length === 0) {
        return decision;
      }
      let lastClaimedIndex = -1;
      for (let i = decision.messages.length - 1; i >= 0; i--) {
        if (messages.includes(decision.messages[i])) {
          lastClaimedIndex = i;
          break;
        }
      }
      const insertAt = lastClaimedIndex + 1;
      const entered = [
        ...decision.messages.slice(0, insertAt),
        ...injectedMessages,
        ...decision.messages.slice(insertAt)
      ];
      return { ...decision, messages: entered };
    },
    { prepend: true }
  );
  void fs6.existsSync;
}

// src/host/guidance.ts
var GUIDANCE_SECTION_NAME = "unified-memory:guidance";
var GUIDANCE_SECTION_ORDER = 5e3;
var UNIFIED_MEMORY_GUIDANCE_TEXT = [
  "## Unified Memory Guidelines",
  "",
  "This environment runs **Unified Memory**, bridging **Claude Code Auto Memory** (read-write, v2.1.x schema) with **OpenAI Codex CLI Memory** (strictly read-only), plus automatic loading of `CLAUDE.md` and `.claude/rules/`.",
  "",
  "### 1. Using Loaded Memories",
  "- Treat injected `MEMORY.md`, topic notes, and Codex Global Memory Summary as historical context, not infallible truth \u2014 verify cited files, symbols, or commands against the live codebase before relying on them.",
  "- Call `claude_memory_read` for full details behind an entry in `MEMORY.md`, and `codex_memory_search` / `codex_memory_read` for cross-session Codex recall. **Never attempt to write to `~/.codex/`.**",
  "",
  "### 2. Saving Claude Auto Memory (`claude_memory_save`)",
  "Follow Claude Code\u2019s 4-category discipline strictly:",
  "1. `user` \u2014 User role, technical expertise, preferences, and recurring workflow habits.",
  "2. `feedback` \u2014 Explicit user corrections, constraints, or confirmed approaches (record **why** and **when to apply**).",
  "3. `project` \u2014 Ongoing decisions, goals, or external deadlines not derivable from repository files or `git log` (convert relative dates to absolute ISO dates).",
  "4. `reference` \u2014 Pointers to external systems (dashboards, trackers, docs, URLs).",
  "",
  "### 3. What Never to Save & Writing Hygiene",
  "- Never save code structure derivable from reading files/`git log`, temporary debug output, rules already in `CLAUDE.md`/`AGENTS.md`, or secrets/tokens/API keys.",
  "- Always use `claude_memory_save` / `claude_memory_delete` instead of directly editing `~/.claude/projects/*/memory/` so v2.1.x `metadata:` frontmatter, cross-process locking, and the 200-line / 25 KB `MEMORY.md` cap stay consistent.",
  "- Check `claude_memory_list` before creating a new topic to avoid duplicates.",
  "- Store memory content in the user\u2019s primary language (e.g., Chinese or English), while keeping YAML frontmatter keys, `type` values, and tool arguments in canonical English."
].join("\n");
function registerGuidanceSection(ctx) {
  ctx.inject(["systemPrompt"], (c) => {
    c.effect(
      () => c.systemPrompt.section({
        name: GUIDANCE_SECTION_NAME,
        order: GUIDANCE_SECTION_ORDER,
        interpolate: false,
        text: UNIFIED_MEMORY_GUIDANCE_TEXT
      })
    );
  });
}

// src/host/routes.ts
import fs7 from "node:fs";
import path7 from "node:path";

// src/shared/api-contract.ts
var PLUGIN_VERSION = "0.1.0";
var API_PATHS = {
  OVERVIEW: "/api/unified-memory/overview",
  CLAUDE_RESOLVE: "/api/unified-memory/claude/resolve",
  CLAUDE_LIST: "/api/unified-memory/claude/list",
  CLAUDE_READ: "/api/unified-memory/claude/read",
  CLAUDE_SAVE: "/api/unified-memory/claude/save",
  CLAUDE_DELETE: "/api/unified-memory/claude/delete",
  CLAUDE_SAVE_INDEX: "/api/unified-memory/claude/save-index",
  CODEX_SUMMARY: "/api/unified-memory/codex/summary",
  CODEX_BROWSE: "/api/unified-memory/codex/browse",
  CODEX_SEARCH: "/api/unified-memory/codex/search",
  CODEX_READ: "/api/unified-memory/codex/read",
  RULES_INSPECT: "/api/unified-memory/rules/inspect",
  CONFIG_UPDATE: "/api/unified-memory/config/update",
  TRUST_UPDATE: "/api/unified-memory/trust/update",
  DIAGNOSTICS_CLEAR: "/api/unified-memory/diagnostics/clear",
  SESSION_CONTEXT: "/api/unified-memory/session/context"
};
var API_ROUTES = {
  OVERVIEW: API_PATHS.OVERVIEW.slice(1),
  CLAUDE_RESOLVE: API_PATHS.CLAUDE_RESOLVE.slice(1),
  CLAUDE_LIST: API_PATHS.CLAUDE_LIST.slice(1),
  CLAUDE_READ: API_PATHS.CLAUDE_READ.slice(1),
  CLAUDE_SAVE: API_PATHS.CLAUDE_SAVE.slice(1),
  CLAUDE_DELETE: API_PATHS.CLAUDE_DELETE.slice(1),
  CLAUDE_SAVE_INDEX: API_PATHS.CLAUDE_SAVE_INDEX.slice(1),
  CODEX_SUMMARY: API_PATHS.CODEX_SUMMARY.slice(1),
  CODEX_BROWSE: API_PATHS.CODEX_BROWSE.slice(1),
  CODEX_SEARCH: API_PATHS.CODEX_SEARCH.slice(1),
  CODEX_READ: API_PATHS.CODEX_READ.slice(1),
  RULES_INSPECT: API_PATHS.RULES_INSPECT.slice(1),
  CONFIG_UPDATE: API_PATHS.CONFIG_UPDATE.slice(1),
  TRUST_UPDATE: API_PATHS.TRUST_UPDATE.slice(1),
  DIAGNOSTICS_CLEAR: API_PATHS.DIAGNOSTICS_CLEAR.slice(1),
  SESSION_CONTEXT: API_PATHS.SESSION_CONTEXT.slice(1)
};

// src/host/routes.ts
function jsonOk(body, status = 200) {
  return Response.json(body, { status });
}
function jsonErr(message, status = 400, code) {
  const payload = code ? { error: message, code } : { error: message };
  return Response.json(payload, { status });
}
async function readJsonBody(request) {
  const text = await request.text();
  if (!text.trim()) return {};
  return JSON.parse(text);
}
function resolveTargetMemoryDir(params, runtime) {
  if (params.projectPath && params.projectPath.trim().length > 0) {
    const res = resolveClaudeProject(params.projectPath.trim(), {
      claudeConfigDir: runtime.claudeConfigDir,
      env: runtime.env
    });
    return {
      memoryDir: res.memoryDir,
      slug: res.slug,
      resolvedRoot: res.resolvedRoot,
      autoMemoryEnabled: res.autoMemoryEnabled
    };
  }
  if (params.slug && params.slug.trim().length > 0) {
    const rawSlug = params.slug.trim();
    const cleanSlug = path7.basename(rawSlug);
    if (cleanSlug !== rawSlug || cleanSlug.includes("..")) {
      throw new Error(`Invalid project slug: ${rawSlug}`);
    }
    const globalSettings = readClaudeSettings(void 0, runtime.claudeConfigDir, runtime.env);
    return {
      memoryDir: path7.join(runtime.claudeConfigDir, "projects", cleanSlug, "memory"),
      slug: cleanSlug,
      resolvedRoot: null,
      autoMemoryEnabled: globalSettings.autoMemoryEnabled
    };
  }
  throw new Error("Either projectPath or slug must be provided");
}
function parseOptionalInt(raw, min, max, fallback) {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function buildOverviewResponse(runtime, queryCwd) {
  const claudeProjects = discoverAllClaudeProjects(runtime.claudeConfigDir, runtime.homeDir);
  const codexStatus = getCodexMemoryStatus(runtime.codexHome);
  const recentSessions = listRecentSessions(runtime.dataDir, 20);
  const activeSessions = runtime.listLiveSessionSummaries();
  const diagnostics = readDiagnosticEvents(runtime.dataDir, 80);
  const config = runtime.getEffectiveConfig();
  const resolvedLocale = runtime.resolveEffectiveLocale();
  const hostLocalePreference = runtime.getHostLocalePreference();
  const workspaceHintsSet = /* @__PURE__ */ new Set();
  if (queryCwd && queryCwd.trim().length > 0) {
    workspaceHintsSet.add(path7.resolve(queryCwd.trim()));
  }
  for (const live of activeSessions) {
    if (live.cwd) workspaceHintsSet.add(live.cwd);
  }
  for (const s of recentSessions) {
    for (const ws of s.workspacePaths) {
      if (ws) workspaceHintsSet.add(ws);
    }
  }
  for (const p of claudeProjects) {
    if (p.exactPathResolved && fs7.existsSync(p.displayPath)) {
      workspaceHintsSet.add(p.displayPath);
    }
  }
  return {
    version: PLUGIN_VERSION,
    pluginDataDir: runtime.dataDir,
    resolvedLocale,
    hostLocalePreference,
    claude: {
      configDir: runtime.claudeConfigDir,
      exists: fs7.existsSync(runtime.claudeConfigDir),
      hasGlobalClaudeMd: fs7.existsSync(path7.join(runtime.claudeConfigDir, "CLAUDE.md")),
      hasGlobalRulesDir: fs7.existsSync(path7.join(runtime.claudeConfigDir, "rules")),
      projectCount: claudeProjects.length,
      totalTopics: claudeProjects.reduce((acc, p) => acc + p.topicCount, 0),
      projects: claudeProjects
    },
    codex: codexStatus,
    activeSessions,
    recentSessions: recentSessions.map((s) => ({
      conversationId: s.conversationId,
      startedAt: s.startedAt,
      updatedAt: s.updatedAt,
      workspacePaths: s.workspacePaths,
      locale: s.locale,
      loadedRuleCount: s.loadedRuleKeys.length,
      loadedSubdirCount: s.loadedSubdirPaths.length,
      indexedConditionalCount: s.indexedConditionalRules.length,
      compactionCount: s.compactionCount,
      hostDedupedCount: s.hostDedupedPaths?.length ?? 0
    })),
    diagnostics,
    config,
    workspaceHints: Array.from(workspaceHintsSet)
  };
}
function registerHttpRoutes(ctx, runtime) {
  ctx.inject(["connection"], (c) => {
    const mount = (routePath, methods, handler) => {
      c.effect(
        () => c.connection.fetch.register({
          path: routePath,
          methods,
          requestBody: "buffered",
          fetch: async (request) => {
            try {
              return await handler(request);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              return jsonErr(message, 400);
            }
          }
        })
      );
    };
    mount(API_PATHS.OVERVIEW, ["GET"], async (request) => {
      const url = new URL(request.url);
      const cwd = url.searchParams.get("cwd");
      return jsonOk(buildOverviewResponse(runtime, cwd));
    });
    mount(API_PATHS.CLAUDE_RESOLVE, ["GET"], async (request) => {
      const url = new URL(request.url);
      const inputPath = url.searchParams.get("path")?.trim();
      if (!inputPath) return jsonErr("Missing required query param: path", 400);
      const res = resolveClaudeProject(inputPath, {
        claudeConfigDir: runtime.claudeConfigDir,
        env: runtime.env
      });
      return jsonOk(res);
    });
    mount(API_PATHS.CLAUDE_LIST, ["GET"], async (request) => {
      const url = new URL(request.url);
      const target = resolveTargetMemoryDir(
        {
          projectPath: url.searchParams.get("projectPath"),
          slug: url.searchParams.get("slug")
        },
        runtime
      );
      const index = readMemoryIndex(target.memoryDir);
      const topics = listTopicMemories(target.memoryDir);
      const payload = {
        slug: target.slug,
        resolvedRoot: target.resolvedRoot,
        memoryDir: target.memoryDir,
        autoMemoryEnabled: target.autoMemoryEnabled,
        index,
        topics
      };
      return jsonOk(payload);
    });
    mount(API_PATHS.CLAUDE_READ, ["GET"], async (request) => {
      const url = new URL(request.url);
      const target = resolveTargetMemoryDir(
        {
          projectPath: url.searchParams.get("projectPath"),
          slug: url.searchParams.get("slug")
        },
        runtime
      );
      const filename = url.searchParams.get("filename")?.trim() ?? "";
      if (!filename || filename === "MEMORY.md") {
        const payload2 = {
          kind: "index",
          slug: target.slug,
          memoryDir: target.memoryDir,
          index: readMemoryIndex(target.memoryDir)
        };
        return jsonOk(payload2);
      }
      const topic = readTopicMemory(target.memoryDir, filename);
      if (!topic) {
        const msg = getMessages(runtime.resolveEffectiveLocale());
        return jsonErr(msg.topicNotFoundError(filename, target.memoryDir), 404, "NOT_FOUND");
      }
      const payload = {
        kind: "topic",
        slug: target.slug,
        memoryDir: target.memoryDir,
        topic
      };
      return jsonOk(payload);
    });
    mount(API_PATHS.CLAUDE_SAVE, ["POST"], async (request) => {
      const body = await readJsonBody(request);
      if (!body.name?.trim() || !body.description?.trim() || !body.body?.trim()) {
        return jsonErr("Fields name, description, and body are required", 400);
      }
      if (!CLAUDE_MEMORY_TYPES.includes(body.type)) {
        return jsonErr(`Invalid memory type: ${String(body.type)}`, 400);
      }
      const target = resolveTargetMemoryDir(body, runtime);
      const locale = runtime.resolveEffectiveLocale();
      if (!target.autoMemoryEnabled) {
        return jsonErr(getMessages(locale).autoMemoryDisabledError, 403, "AUTO_MEMORY_DISABLED");
      }
      const res = saveTopicMemory(target.memoryDir, {
        filename: body.filename,
        name: body.name,
        description: body.description,
        type: body.type,
        body: body.body,
        originSessionId: body.originSessionId,
        locale
      });
      const payload = {
        slug: target.slug,
        topic: res.topic,
        index: res.index,
        warnings: res.warnings
      };
      return jsonOk(payload);
    });
    mount(API_PATHS.CLAUDE_DELETE, ["POST"], async (request) => {
      const body = await readJsonBody(request);
      if (!body.filename?.trim()) {
        return jsonErr("Field filename is required", 400);
      }
      const target = resolveTargetMemoryDir(body, runtime);
      const res = deleteTopicMemory(target.memoryDir, body.filename.trim());
      const payload = {
        slug: target.slug,
        deleted: res.deleted,
        index: res.index
      };
      return jsonOk(payload);
    });
    mount(API_PATHS.CLAUDE_SAVE_INDEX, ["POST"], async (request) => {
      const body = await readJsonBody(request);
      if (typeof body.content !== "string") {
        return jsonErr("Field content must be a string", 400);
      }
      const target = resolveTargetMemoryDir(body, runtime);
      if (!target.autoMemoryEnabled) {
        const msg = getMessages(runtime.resolveEffectiveLocale());
        return jsonErr(msg.autoMemoryDisabledError, 403, "AUTO_MEMORY_DISABLED");
      }
      const index = writeMemoryIndexRaw(target.memoryDir, body.content);
      const payload = { slug: target.slug, index };
      return jsonOk(payload);
    });
    mount(API_PATHS.CODEX_SUMMARY, ["GET"], async (request) => {
      const url = new URL(request.url);
      const rawGen = url.searchParams.get("generation");
      const gen = rawGen === "v2" || rawGen === "v1" ? rawGen : "auto";
      const maxBytes = parseOptionalInt(url.searchParams.get("maxBytes"), 512, 65536, 32 * 1024);
      const status = getCodexMemoryStatus(runtime.codexHome);
      const selectedGeneration = gen !== "auto" ? gen : status.activeGeneration === "none" ? "v2" : status.activeGeneration;
      const summary = readCodexSummary({
        codexHome: runtime.codexHome,
        generation: selectedGeneration,
        maxBytes
      });
      const payload = {
        readOnly: true,
        status,
        selectedGeneration,
        summary
      };
      return jsonOk(payload);
    });
    mount(API_PATHS.CODEX_BROWSE, ["GET"], async (request) => {
      const url = new URL(request.url);
      const rawGen = url.searchParams.get("generation");
      const gen = rawGen === "v2" || rawGen === "v1" ? rawGen : "auto";
      const status = getCodexMemoryStatus(runtime.codexHome);
      const selectedGeneration = gen !== "auto" ? gen : status.activeGeneration === "none" ? "v2" : status.activeGeneration;
      const summary = readCodexSummary({
        codexHome: runtime.codexHome,
        generation: selectedGeneration,
        maxBytes: 32 * 1024
      });
      const files = listCodexFiles(selectedGeneration, runtime.codexHome);
      const payload = {
        readOnly: true,
        status,
        selectedGeneration,
        summary,
        files
      };
      return jsonOk(payload);
    });
    mount(API_PATHS.CODEX_SEARCH, ["POST"], async (request) => {
      const body = await readJsonBody(request);
      const query = body.query?.trim() ?? "";
      if (!query) {
        return jsonErr("Field query must be a non-empty string", 400);
      }
      const generation = body.generation === "v2" || body.generation === "v1" || body.generation === "both" ? body.generation : "auto";
      const limit = typeof body.limit === "number" ? Math.max(1, Math.min(50, Math.trunc(body.limit))) : 25;
      const hits = searchCodexMemories(query, {
        codexHome: runtime.codexHome,
        projectHint: body.projectHint?.trim() || void 0,
        generation,
        limit
      });
      const payload = {
        readOnly: true,
        query,
        projectHint: body.projectHint?.trim() || null,
        hits
      };
      return jsonOk(payload);
    });
    mount(API_PATHS.CODEX_READ, ["GET"], async (request) => {
      const url = new URL(request.url);
      const generation = url.searchParams.get("generation");
      const relativePath = url.searchParams.get("relativePath")?.trim() ?? "";
      if (generation !== "v2" && generation !== "v1") {
        return jsonErr('Query param generation must be "v2" or "v1"', 400);
      }
      if (!relativePath) {
        return jsonErr("Missing required query param: relativePath", 400);
      }
      const maxBytes = parseOptionalInt(url.searchParams.get("maxBytes"), 512, 131072, 64 * 1024);
      try {
        const result = readCodexMemoryFile(generation, relativePath, runtime.codexHome, maxBytes);
        const payload = {
          readOnly: true,
          generation: result.generation,
          relativePath: result.relativePath,
          filePath: result.filePath,
          exists: true,
          content: result.content,
          sizeBytes: result.totalBytes,
          truncated: result.truncated,
          mtimeMs: result.mtimeMs
        };
        return jsonOk(payload);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = /not found/i.test(message) ? 404 : 400;
        return jsonErr(message, status);
      }
    });
    mount(API_PATHS.RULES_INSPECT, ["GET"], async (request) => {
      const url = new URL(request.url);
      const workspaceParam = url.searchParams.get("workspacePath")?.trim() ?? "";
      const sessionIdParam = url.searchParams.get("sessionId")?.trim() ?? "";
      const cfg = runtime.getEffectiveConfig();
      const matchedLive = sessionIdParam ? runtime.liveSessions.get(sessionIdParam) : workspaceParam ? Array.from(runtime.liveSessions.values()).find(
        (s) => s.cwd && path7.resolve(s.cwd) === path7.resolve(workspaceParam)
      ) : runtime.liveSessions.values().next().value;
      const resolvedWs = workspaceParam ? path7.resolve(workspaceParam) : matchedLive?.cwd ?? null;
      const hostLoadedPaths = matchedLive?.hostLoadedPaths ?? [];
      const hostLoadedSet = new Set(hostLoadedPaths);
      const loaded = loadClaudeRulesForWorkspaces(resolvedWs ? [resolvedWs] : [], {
        claudeConfigDir: runtime.claudeConfigDir,
        homeDir: runtime.homeDir,
        deduplicateNativeAgentsMd: cfg.deduplicateNativeAgentsMd,
        nativeRuleFilenames: DEFAULT_NATIVE_RULE_FILENAMES,
        hostName: DEFAULT_HOST_NAME,
        alreadyLoadedPaths: hostLoadedSet,
        trustClaudeCodeExternalApprovals: cfg.trustClaudeCodeExternalApprovals,
        externalRuleTrust: cfg.externalRuleTrust
      });
      const sessions = listRecentSessions(runtime.dataDir, 15);
      const payload = {
        workspacePath: resolvedWs,
        globalAlwaysOn: loaded.globalAlwaysOn,
        globalConditional: loaded.globalConditional,
        workspace: loaded.workspaces[0] ?? null,
        hostLoadedPaths,
        workspaceExternalTrust: resolvedWs ? getWorkspaceExternalTrust(cfg.externalRuleTrust, resolvedWs) : { allowPaths: [], denyPaths: [] },
        trustClaudeCodeExternalApprovals: cfg.trustClaudeCodeExternalApprovals,
        recentSessionHits: sessions.filter(
          (s) => s.loadedRuleKeys.length > 0 || s.loadedSubdirPaths.length > 0 || (s.hostDedupedPaths?.length ?? 0) > 0
        ).map((s) => ({
          conversationId: s.conversationId,
          updatedAt: s.updatedAt,
          loadedRuleKeys: s.loadedRuleKeys,
          loadedSubdirPaths: s.loadedSubdirPaths,
          compactionCount: s.compactionCount,
          hostDedupedPaths: s.hostDedupedPaths ?? []
        }))
      };
      return jsonOk(payload);
    });
    mount(API_PATHS.CONFIG_UPDATE, ["POST"], async (request) => {
      const body = await readJsonBody(request);
      const patch = {};
      if (body.locale !== void 0) {
        patch.locale = normalizeLocalePreference(body.locale);
      }
      if (typeof body.injectCodexSummaryOnStart === "boolean") {
        patch.injectCodexSummaryOnStart = body.injectCodexSummaryOnStart;
      }
      if (typeof body.codexSummaryMaxBytes === "number" && Number.isFinite(body.codexSummaryMaxBytes)) {
        patch.codexSummaryMaxBytes = Math.max(512, Math.min(65536, Math.trunc(body.codexSummaryMaxBytes)));
      }
      if (typeof body.injectCodexGlobalAgentsMd === "boolean") {
        patch.injectCodexGlobalAgentsMd = body.injectCodexGlobalAgentsMd;
      }
      if (typeof body.deduplicateNativeAgentsMd === "boolean") {
        patch.deduplicateNativeAgentsMd = body.deduplicateNativeAgentsMd;
      }
      if (typeof body.maxStartupInjectBytes === "number" && Number.isFinite(body.maxStartupInjectBytes)) {
        patch.maxStartupInjectBytes = Math.max(
          4096,
          Math.min(262144, Math.trunc(body.maxStartupInjectBytes))
        );
      }
      if (typeof body.trustClaudeCodeExternalApprovals === "boolean") {
        patch.trustClaudeCodeExternalApprovals = body.trustClaudeCodeExternalApprovals;
      }
      const updated = runtime.updatePersistedConfig(patch);
      const payload = {
        config: updated,
        resolvedLocale: runtime.resolveEffectiveLocale(updated.locale)
      };
      return jsonOk(payload);
    });
    mount(API_PATHS.TRUST_UPDATE, ["POST"], async (request) => {
      const body = await readJsonBody(request);
      if (!body.workspacePath?.trim()) {
        return jsonErr("Field workspacePath is required", 400);
      }
      const validActions = ["allow", "deny", "revoke", "clear_workspace"];
      if (!validActions.includes(body.action)) {
        return jsonErr(`Invalid trust action: ${String(body.action)}`, 400);
      }
      const res = updateWorkspaceExternalTrust(
        body.workspacePath.trim(),
        body.action,
        body.targetPath,
        runtime.dataDir
      );
      const payload = {
        workspaceKey: res.workspaceKey,
        trust: res.trust,
        trustClaudeCodeExternalApprovals: res.config.trustClaudeCodeExternalApprovals
      };
      return jsonOk(payload);
    });
    mount(API_PATHS.DIAGNOSTICS_CLEAR, ["POST"], async () => {
      clearDiagnosticEvents(runtime.dataDir);
      const payload = { cleared: true };
      return jsonOk(payload);
    });
    mount(API_PATHS.SESSION_CONTEXT, ["GET"], async (request) => {
      const url = new URL(request.url);
      const requestedId = url.searchParams.get("sessionId")?.trim() ?? "";
      const activeSessions = runtime.listLiveSessionSummaries();
      let snapshot = requestedId ? runtime.liveSessions.get(requestedId) ?? null : null;
      if (!snapshot && !requestedId && activeSessions.length > 0) {
        snapshot = runtime.liveSessions.get(activeSessions[0].sessionId) ?? null;
      }
      if (!snapshot && requestedId) {
        const liveAgent = ctx.agents.list().find((a) => String(a.id) === requestedId);
        if (liveAgent) {
          const cwd = await runtime.resolveAgentCwd(liveAgent);
          const resolution = cwd ? resolveClaudeProject(cwd, {
            claudeConfigDir: runtime.claudeConfigDir,
            env: runtime.env
          }) : null;
          const memIndex = resolution && resolution.autoMemoryEnabled ? readMemoryIndex(resolution.memoryDir) : null;
          const topics = resolution && resolution.autoMemoryEnabled ? listTopicMemories(resolution.memoryDir) : [];
          snapshot = {
            sessionId: requestedId,
            cwd,
            resolvedProjectRoot: resolution?.resolvedRoot ?? null,
            claudeSlug: resolution?.slug ?? null,
            resolvedLocale: runtime.resolveEffectiveLocale(),
            origin: liveAgent.session.header.origin === "subagent" ? "subagent" : "root",
            isSeeded: Boolean(liveAgent.session.header.isSeeded),
            baselineInjected: false,
            baselineInjectedAt: null,
            baselineBytes: 0,
            replaceGeneration: liveAgent.session.surface.replaceGeneration,
            compactionCount: 0,
            hostAgentInstructionsActive: false,
            hostLoadedPaths: [],
            injectedLabels: [],
            loadedAlwaysOnRules: [],
            indexedConditionalRules: [],
            loadedSubdirClaudeMds: [],
            pendingExternalApprovalCount: 0,
            claudeMemoryIndex: memIndex ? {
              exists: memIndex.exists,
              totalLines: memIndex.totalLines,
              maxLines: memIndex.maxLines,
              totalBytes: memIndex.totalBytes,
              maxBytes: memIndex.maxBytes,
              truncated: memIndex.truncated,
              topicCount: topics.length
            } : null,
            codexSummaryInjected: false,
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
      }
      const payload = {
        session: snapshot,
        activeSessions
      };
      return jsonOk(payload);
    });
  });
}

// src/host/runtime.ts
import fs8 from "node:fs";
import os5 from "node:os";
import path8 from "node:path";
import { dshHomePath } from "@deepseek-ai/dsh-home-paths";
function unwrapVolatile(value) {
  if (value !== null && typeof value === "object" && "get" in value && typeof value.get === "function") {
    return value.get();
  }
  return value;
}
function readCordisOverrides(rawConfig) {
  if (!rawConfig) return {};
  const out = {};
  const locale = unwrapVolatile(rawConfig.locale);
  if (locale !== void 0) out.locale = normalizeLocalePreference(locale);
  const injectCodexSummaryOnStart = unwrapVolatile(rawConfig.injectCodexSummaryOnStart);
  if (typeof injectCodexSummaryOnStart === "boolean") {
    out.injectCodexSummaryOnStart = injectCodexSummaryOnStart;
  }
  const codexSummaryMaxBytes = unwrapVolatile(rawConfig.codexSummaryMaxBytes);
  if (typeof codexSummaryMaxBytes === "number" && codexSummaryMaxBytes >= 512) {
    out.codexSummaryMaxBytes = codexSummaryMaxBytes;
  }
  const injectCodexGlobalAgentsMd = unwrapVolatile(rawConfig.injectCodexGlobalAgentsMd);
  if (typeof injectCodexGlobalAgentsMd === "boolean") {
    out.injectCodexGlobalAgentsMd = injectCodexGlobalAgentsMd;
  }
  const deduplicateNativeAgentsMd = unwrapVolatile(rawConfig.deduplicateNativeAgentsMd);
  if (typeof deduplicateNativeAgentsMd === "boolean") {
    out.deduplicateNativeAgentsMd = deduplicateNativeAgentsMd;
  }
  const maxStartupInjectBytes = unwrapVolatile(rawConfig.maxStartupInjectBytes);
  if (typeof maxStartupInjectBytes === "number" && maxStartupInjectBytes >= 4096) {
    out.maxStartupInjectBytes = maxStartupInjectBytes;
  }
  const trustClaudeCodeExternalApprovals = unwrapVolatile(
    rawConfig.trustClaudeCodeExternalApprovals
  );
  if (typeof trustClaudeCodeExternalApprovals === "boolean") {
    out.trustClaudeCodeExternalApprovals = trustClaudeCodeExternalApprovals;
  }
  return out;
}
function createHostRuntime(ctx, rawConfig, env = process.env) {
  const homeDir = os5.homedir();
  const envOverride = env.UNIFIED_MEMORY_DATA_DIR?.trim() || env.PLUGIN_DATA?.trim();
  const explicitDataDir = rawConfig?.dataDir?.trim() || (envOverride ? void 0 : dshHomePath("storages", "unified-memory"));
  const dataDir = resolvePluginDataDir(env, explicitDataDir);
  const claudeConfigDir = getClaudeConfigDir(env);
  const codexHome = getCodexHome(env);
  const liveSessions = /* @__PURE__ */ new Map();
  const pendingReloadSessions = /* @__PURE__ */ new Set();
  const getEffectiveConfig = () => {
    const cfgPath = path8.join(dataDir, "config.json");
    const cordisOverrides = readCordisOverrides(rawConfig);
    if (!fs8.existsSync(cfgPath)) {
      return {
        ...DEFAULT_CONFIG,
        ...cordisOverrides,
        externalRuleTrust: {}
      };
    }
    const persisted = loadPluginConfig(dataDir);
    return {
      ...DEFAULT_CONFIG,
      ...cordisOverrides,
      ...persisted
    };
  };
  const updatePersistedConfig = (patch) => {
    const base = getEffectiveConfig();
    return savePluginConfig({ ...base, ...patch }, dataDir);
  };
  const getHostLocalePreference = () => {
    try {
      const settings = ctx.get("settings");
      if (!settings) return null;
      const descriptors = settings.describe();
      const localeDesc = descriptors.find((d) => String(d.ns) === "locale");
      const val = localeDesc?.value;
      if (val && typeof val === "object" && "preference" in val) {
        const pref = val.preference;
        if (typeof pref === "string" && pref.trim().length > 0) {
          return pref.trim();
        }
      }
    } catch {
    }
    return null;
  };
  const resolveEffectiveLocale = (overridePref) => {
    const cfg = getEffectiveConfig();
    return resolveLocale({
      configLocale: overridePref ?? cfg.locale,
      env,
      hostLocale: getHostLocalePreference()
    });
  };
  const getLiveSessionSummary = (snapshot) => ({
    sessionId: snapshot.sessionId,
    cwd: snapshot.cwd,
    resolvedProjectRoot: snapshot.resolvedProjectRoot,
    claudeSlug: snapshot.claudeSlug,
    resolvedLocale: snapshot.resolvedLocale,
    origin: snapshot.origin,
    isSeeded: snapshot.isSeeded,
    baselineInjected: snapshot.baselineInjected,
    compactionCount: snapshot.compactionCount,
    hostDedupedCount: snapshot.hostLoadedPaths.length,
    loadedRuleCount: snapshot.indexedConditionalRules.filter((r) => r.loaded).length,
    loadedSubdirCount: snapshot.loadedSubdirClaudeMds.length,
    updatedAt: snapshot.updatedAt
  });
  const listLiveSessionSummaries = () => Array.from(liveSessions.values()).map(getLiveSessionSummary).sort((a, b) => a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0);
  const resolveAgentCwd = async (agent, signal) => {
    if (!agent) return null;
    try {
      const cwd = await ctx.workingDirectory.ensure(agent, signal);
      return cwd ? path8.resolve(cwd) : null;
    } catch {
      const headerCwd = agent.session?.header?.cwd;
      return typeof headerCwd === "string" && headerCwd.trim() ? path8.resolve(headerCwd.trim()) : null;
    }
  };
  ctx.on("agent/disposed", ({ agent }) => {
    const id = String(agent.id);
    liveSessions.delete(id);
    pendingReloadSessions.delete(id);
  });
  return {
    ctx,
    env,
    homeDir,
    dataDir,
    claudeConfigDir,
    codexHome,
    getEffectiveConfig,
    updatePersistedConfig,
    getHostLocalePreference,
    resolveEffectiveLocale,
    liveSessions,
    pendingReloadSessions,
    getLiveSessionSummary,
    listLiveSessionSummaries,
    resolveAgentCwd
  };
}

// src/host/skills.ts
var MEMORY_MANAGE_DESCRIPTION = "Inspect, search, diagnose, edit, or clean up Claude Code Auto Memory, CLAUDE.md / .claude/rules loading, and read-only Codex CLI memories. Use when the user asks to view memory status (/memory), debug why a rule or memory did or did not load, or manage memories. | \u67E5\u770B\u3001\u641C\u7D22\u3001\u8BCA\u65AD\u3001\u7F16\u8F91\u6216\u6574\u7406\u8DE8\u4F1A\u8BDD\u957F\u671F\u8BB0\u5FC6\u3001CLAUDE.md/.claude/rules \u89C4\u5219\u52A0\u8F7D\u72B6\u6001\u4E0E\u53EA\u8BFB Codex \u8BB0\u5FC6\u3002";
var MEMORY_MANAGE_CONTENT = `# Manage Unified Memory / \u7BA1\u7406\u7EDF\u4E00\u8BB0\u5FC6

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
var MEMORY_DREAM_DESCRIPTION = "Consolidate, deduplicate, prune stale entries, and keep Claude Code Auto Memory (MEMORY.md + topic files) healthy under the 200-line / 25 KB index budget \u2014 equivalent to Claude Code Auto Dream. Use when asked to clean up, audit, consolidate, or dream-prune memories. | \u6574\u7406\u3001\u53BB\u91CD\u3001\u6E05\u7406\u8FC7\u671F\u8BB0\u5FC6\uFF0C\u4FDD\u6301 Claude \u81EA\u52A8\u8BB0\u5FC6\uFF08MEMORY.md \u4E0E\u4E3B\u9898\u6587\u4EF6\uFF09\u5728 200 \u884C / 25 KB \u4E0A\u9650\u5185\u5065\u5EB7\u7CBE\u7B80\uFF08\u5BF9\u5E94 Auto Dream \u8BB0\u5FC6\u7EF4\u62A4\uFF09\u3002";
var MEMORY_DREAM_CONTENT = `# Memory Consolidation ("Auto Dream") / \u8BB0\u5FC6\u6574\u7406\u4E0E\u53BB\u91CD

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
function registerBundledSkills(ctx) {
  ctx.inject(["skills"], (c) => {
    c.effect(
      () => c.skills.register({
        name: "memory-manage",
        description: MEMORY_MANAGE_DESCRIPTION,
        content: MEMORY_MANAGE_CONTENT,
        source: "bundled"
      })
    );
    c.effect(
      () => c.skills.register({
        name: "memory-dream",
        description: MEMORY_DREAM_DESCRIPTION,
        content: MEMORY_DREAM_CONTENT,
        source: "bundled"
      })
    );
  });
}

// src/host/tools.ts
import path9 from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
async function resolveWorkspaceArg(explicitPath, exec, runtime) {
  if (explicitPath && explicitPath.trim().length > 0) {
    return path9.resolve(explicitPath.trim());
  }
  const cwd = await runtime.resolveAgentCwd(exec.agent, exec.signal);
  if (cwd) return cwd;
  throw new Error("Unable to resolve workspace path; pass projectPath/workspacePath explicitly.");
}
function renderJsonText(_args, value) {
  return [{ type: "text", text: JSON.stringify(value, null, 2) }];
}
function toJsonObject(value) {
  return JSON.parse(JSON.stringify(value));
}
function registerHostTools(ctx, runtime) {
  const register = (tool) => {
    ctx.effect(() => ctx.tools.register(tool));
  };
  register(
    defineTool({
      name: "claude_memory_status",
      description: "Resolve the active workspace (or an explicit projectPath) to its canonical Claude Code Auto Memory directory (Git worktree, autoMemoryDirectory, slug encoding) and report MEMORY.md budget usage. | \u89E3\u6790\u5F53\u524D\u5DE5\u4F5C\u533A\u7684 Claude \u81EA\u52A8\u8BB0\u5FC6\u76EE\u5F55\u4E0E MEMORY.md \u5BB9\u91CF\u4F7F\u7528\u60C5\u51B5\u3002",
      parameters: {
        projectPath: {
          type: "string",
          description: "Optional workspace/project path. Defaults to the current session working directory."
        }
      },
      output: {
        schema: { type: "json" },
        render: renderJsonText
      },
      isConcurrencySafe: () => true,
      presentCall: (args) => ({
        card: "generic",
        kind: "read",
        title: args.projectPath ? `Claude memory status (${path9.basename(args.projectPath)})` : "Claude memory status"
      }),
      async execute(args, exec) {
        const ws = await resolveWorkspaceArg(args.projectPath, exec, runtime);
        const resolution = resolveClaudeProject(ws, {
          claudeConfigDir: runtime.claudeConfigDir,
          env: runtime.env
        });
        const index = readMemoryIndex(resolution.memoryDir);
        const topics = listTopicMemories(resolution.memoryDir);
        const byType = {};
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
            truncated: index.truncated
          },
          topicCount: topics.length,
          topicsByType: byType
        });
      }
    })
  );
  register(
    defineTool({
      name: "claude_memory_list",
      description: "List all Claude Code Auto Memory topic files and MEMORY.md index summary for the active project (or projectPath). | \u5217\u51FA\u5F53\u524D\u9879\u76EE\u7684 Claude \u81EA\u52A8\u8BB0\u5FC6\u4E3B\u9898\u6587\u4EF6\u4E0E MEMORY.md \u6458\u8981\u3002",
      parameters: {
        projectPath: {
          type: "string",
          description: "Optional workspace/project path. Defaults to the current session working directory."
        },
        type: {
          type: "string",
          enum: ["user", "feedback", "project", "reference"],
          description: "Optional filter by Claude Code memory category."
        }
      },
      output: {
        schema: { type: "json" },
        render: renderJsonText
      },
      isConcurrencySafe: () => true,
      presentCall: (args) => ({
        card: "generic",
        kind: "read",
        title: args.type ? `List Claude memories (${args.type})` : "List Claude memories"
      }),
      async execute(args, exec) {
        const ws = await resolveWorkspaceArg(args.projectPath, exec, runtime);
        const resolution = resolveClaudeProject(ws, {
          claudeConfigDir: runtime.claudeConfigDir,
          env: runtime.env
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
            preview: index.truncatedContent
          },
          topics: topics.map((t) => ({
            filename: t.filename,
            name: t.name,
            description: t.description,
            type: t.type,
            schema: t.schema,
            modified: t.modified ?? null,
            sizeBytes: t.sizeBytes
          }))
        };
      }
    })
  );
  register(
    defineTool({
      name: "claude_memory_read",
      description: "Read MEMORY.md (when filename is omitted) or a specific Claude Code topic memory markdown file. | \u8BFB\u53D6 MEMORY.md \u7D22\u5F15\u6216\u6307\u5B9A\u7684 Claude \u4E3B\u9898\u8BB0\u5FC6\u6587\u4EF6\u3002",
      parameters: {
        projectPath: {
          type: "string",
          description: "Optional workspace/project path. Defaults to the current session working directory."
        },
        filename: {
          type: "string",
          description: 'Topic filename (e.g. "feedback_testing.md"). Omit to read MEMORY.md.'
        }
      },
      output: {
        schema: { type: "json" },
        render: renderJsonText
      },
      isConcurrencySafe: () => true,
      presentCall: (args) => ({
        card: "generic",
        kind: "read",
        title: `Read memory ${args.filename?.trim() || "MEMORY.md"}`
      }),
      async execute(args, exec) {
        const ws = await resolveWorkspaceArg(args.projectPath, exec, runtime);
        const resolution = resolveClaudeProject(ws, {
          claudeConfigDir: runtime.claudeConfigDir,
          env: runtime.env
        });
        const trimmed = args.filename?.trim() ?? "";
        if (!trimmed || trimmed === "MEMORY.md") {
          return toJsonObject(readMemoryIndex(resolution.memoryDir));
        }
        const topic = readTopicMemory(resolution.memoryDir, trimmed);
        if (!topic) {
          const msg = getMessages(runtime.resolveEffectiveLocale());
          throw new Error(msg.topicNotFoundError(trimmed, resolution.memoryDir));
        }
        return toJsonObject(topic);
      }
    })
  );
  register(
    defineTool({
      name: "claude_memory_save",
      description: "Create or update a Claude Code Auto Memory topic file using the v2.1.x nested metadata schema (node_type: memory), with cross-process locking, atomic writes, and automatic MEMORY.md sync. | \u521B\u5EFA\u6216\u66F4\u65B0 Claude \u81EA\u52A8\u8BB0\u5FC6\u4E3B\u9898\u6587\u4EF6\uFF08\u517C\u5BB9 v2.1.x \u683C\u5F0F\u4E0E\u8DE8\u8FDB\u7A0B\u6587\u4EF6\u9501\uFF09\uFF0C\u5E76\u81EA\u52A8\u540C\u6B65 MEMORY.md \u7D22\u5F15\u3002",
      parameters: {
        projectPath: {
          type: "string",
          description: "Optional workspace/project path. Defaults to the current session working directory."
        },
        name: {
          type: "string",
          required: true,
          description: "Short title or slug for this memory topic (Chinese or English supported)."
        },
        description: {
          type: "string",
          required: true,
          description: "Concise one-line description used for relevance recall and MEMORY.md index."
        },
        type: {
          type: "string",
          enum: ["user", "feedback", "project", "reference"],
          required: true,
          description: "Claude Code memory category: user | feedback | project | reference."
        },
        body: {
          type: "string",
          required: true,
          description: "Markdown body content of the memory note."
        },
        filename: {
          type: "string",
          description: 'Optional explicit filename (e.g. "feedback_db_tests.md"). Derived from name if omitted.'
        },
        originSessionId: {
          type: "string",
          description: "Optional session ID recorded in metadata.originSessionId (auto-filled from current session)."
        }
      },
      output: {
        schema: { type: "json" },
        render: renderJsonText
      },
      presentCall: (args) => ({
        card: "generic",
        kind: "edit",
        title: `Save Claude memory: ${args.name} (${args.type})`
      }),
      async execute(args, exec) {
        const ws = await resolveWorkspaceArg(args.projectPath, exec, runtime);
        const locale = runtime.resolveEffectiveLocale();
        const msg = getMessages(locale);
        const resolution = resolveClaudeProject(ws, {
          claudeConfigDir: runtime.claudeConfigDir,
          env: runtime.env
        });
        if (!resolution.autoMemoryEnabled) {
          throw new Error(msg.autoMemoryDisabledError);
        }
        const originSessionId = args.originSessionId?.trim() || (exec.agent ? String(exec.agent.id) : void 0);
        const result = saveTopicMemory(resolution.memoryDir, {
          filename: args.filename,
          name: args.name,
          description: args.description,
          type: args.type,
          body: args.body,
          originSessionId,
          locale
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
          warnings: result.warnings
        };
      }
    })
  );
  register(
    defineTool({
      name: "claude_memory_delete",
      description: "Delete a Claude Code topic memory file and atomically remove its pointer line from MEMORY.md. | \u5220\u9664\u6307\u5B9A Claude \u4E3B\u9898\u8BB0\u5FC6\u6587\u4EF6\u5E76\u539F\u5B50\u79FB\u9664 MEMORY.md \u4E2D\u7684\u7D22\u5F15\u6761\u76EE\u3002",
      parameters: {
        projectPath: {
          type: "string",
          description: "Optional workspace/project path. Defaults to the current session working directory."
        },
        filename: {
          type: "string",
          required: true,
          description: "Filename of the topic markdown file to delete."
        }
      },
      output: {
        schema: { type: "json" },
        render: renderJsonText
      },
      presentCall: (args) => ({
        card: "generic",
        kind: "delete",
        title: `Delete Claude memory: ${args.filename}`
      }),
      async execute(args, exec) {
        const ws = await resolveWorkspaceArg(args.projectPath, exec, runtime);
        const resolution = resolveClaudeProject(ws, {
          claudeConfigDir: runtime.claudeConfigDir,
          env: runtime.env
        });
        const res = deleteTopicMemory(resolution.memoryDir, args.filename);
        return {
          deleted: res.deleted,
          filename: args.filename,
          memoryDir: resolution.memoryDir,
          remainingIndexLines: res.index.totalLines
        };
      }
    })
  );
  register(
    defineTool({
      name: "claude_rules_inspect",
      description: "Inspect all CLAUDE.md hierarchy files (with @import chains, external trust status, and host dsh-agent-instructions deduplication) and .claude/rules/ files (always-on vs paths-scoped). | \u68C0\u67E5\u5DE5\u4F5C\u533A\u5168\u90E8 CLAUDE.md \u5C42\u7EA7\u3001@import \u5C55\u5F00\u3001\u5BBF\u4E3B\u53BB\u91CD\u72B6\u6001\u3001\u5916\u90E8\u4FE1\u4EFB\u62E6\u622A\u4E0E .claude/rules/ \u6761\u4EF6\u89C4\u5219\u3002",
      parameters: {
        workspacePath: {
          type: "string",
          description: "Optional workspace directory. Defaults to the current session working directory."
        }
      },
      output: {
        schema: { type: "json" },
        render: renderJsonText
      },
      isConcurrencySafe: () => true,
      presentCall: (args) => ({
        card: "generic",
        kind: "read",
        title: args.workspacePath ? `Inspect Claude rules (${path9.basename(args.workspacePath)})` : "Inspect Claude rules"
      }),
      async execute(args, exec) {
        const ws = await resolveWorkspaceArg(args.workspacePath, exec, runtime);
        const cfg = runtime.getEffectiveConfig();
        const locale = runtime.resolveEffectiveLocale();
        const msg = getMessages(locale);
        const liveSnap = exec.agent ? runtime.liveSessions.get(String(exec.agent.id)) : void 0;
        const hostLoadedSet = new Set(liveSnap?.hostLoadedPaths ?? []);
        const loaded = loadClaudeRulesForWorkspaces([ws], {
          claudeConfigDir: runtime.claudeConfigDir,
          homeDir: runtime.homeDir,
          deduplicateNativeAgentsMd: cfg.deduplicateNativeAgentsMd,
          nativeRuleFilenames: DEFAULT_NATIVE_RULE_FILENAMES,
          hostName: DEFAULT_HOST_NAME,
          alreadyLoadedPaths: hostLoadedSet,
          trustClaudeCodeExternalApprovals: cfg.trustClaudeCodeExternalApprovals,
          externalRuleTrust: cfg.externalRuleTrust
        });
        const wsBundle = loaded.workspaces[0];
        const summarize = (r) => ({
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
          sizeBytes: r.sizeBytes
        });
        const blockedExternalCount = wsBundle ? wsBundle.blockedExternalTargets.length : 0;
        const pendingExternalApprovalCount = wsBundle ? wsBundle.blockedExternalTargets.filter((b) => b.status === "pending_approval").length : 0;
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
            ...pendingExternalApprovalCount > 0 ? { note: msg.externalTargetsApprovalNote } : {}
          }
        };
      }
    })
  );
  register(
    defineTool({
      name: "codex_memory_summary",
      description: "Read-only overview of OpenAI Codex CLI local memories (~/.codex/memories_v2 preferred, fallback ~/.codex/memories) and memory_summary.md. | \u53EA\u8BFB\u67E5\u770B OpenAI Codex \u672C\u5730\u8BB0\u5FC6\u72B6\u6001\u4E0E memory_summary.md \u6458\u8981\u3002",
      parameters: {
        generation: {
          type: "string",
          enum: ["auto", "v2", "v1"],
          description: "Codex memory generation to inspect (default: auto)."
        },
        maxBytes: {
          type: "integer",
          description: "Maximum bytes of memory_summary.md to return (512..65536, default 12288)."
        }
      },
      output: {
        schema: { type: "json" },
        render: renderJsonText
      },
      isConcurrencySafe: () => true,
      presentCall: (args) => ({
        card: "generic",
        kind: "read",
        title: `Codex memory summary (${args.generation ?? "auto"}, read-only)`
      }),
      async execute(args) {
        const boundedMax = typeof args.maxBytes === "number" ? Math.max(512, Math.min(65536, args.maxBytes)) : 12 * 1024;
        const status = getCodexMemoryStatus(runtime.codexHome);
        const summary = readCodexSummary({
          codexHome: runtime.codexHome,
          generation: args.generation ?? "auto",
          maxBytes: boundedMax
        });
        return toJsonObject({ readOnly: true, status, summary });
      }
    })
  );
  register(
    defineTool({
      name: "codex_memory_search",
      description: "Search across read-only Codex memories (memory_summary.md, rollout_summaries, extensions/ad_hoc, skills, v1 MEMORY.md handbook), supporting Chinese & English queries. | \u8DE8\u4EE3\u6B21\u68C0\u7D22\u53EA\u8BFB Codex \u8BB0\u5FC6\uFF08\u652F\u6301\u4E2D\u82F1\u6587\u4E0E\u9879\u76EE\u540D\u52A0\u6743\uFF09\u3002",
      parameters: {
        query: {
          type: "string",
          required: true,
          description: "Keywords or topic to search for (English or Chinese)."
        },
        projectHint: {
          type: "string",
          description: "Optional repo/project name to boost relevant cross-repo results."
        },
        generation: {
          type: "string",
          enum: ["auto", "v2", "v1", "both"],
          description: "Generation scope to search (default: auto)."
        },
        limit: {
          type: "integer",
          description: "Maximum hits to return (1..30, default 10)."
        }
      },
      output: {
        schema: { type: "json" },
        render: renderJsonText
      },
      isConcurrencySafe: () => true,
      presentCall: (args) => ({
        card: "generic",
        kind: "search",
        title: `Search Codex memory: ${args.query}`
      }),
      async execute(args) {
        const limit = typeof args.limit === "number" ? Math.max(1, Math.min(30, args.limit)) : 10;
        const hits = searchCodexMemories(args.query, {
          codexHome: runtime.codexHome,
          projectHint: args.projectHint,
          generation: args.generation ?? "auto",
          limit
        });
        return toJsonObject({
          readOnly: true,
          query: args.query,
          projectHint: args.projectHint ?? null,
          hits
        });
      }
    })
  );
  register(
    defineTool({
      name: "codex_memory_read",
      description: "Read a specific markdown file inside ~/.codex/memories_v2 or ~/.codex/memories (strictly read-only and path-jailed). | \u53EA\u8BFB\u8BFB\u53D6\u6307\u5B9A Codex \u8BB0\u5FC6\u6587\u4EF6\uFF08\u8DEF\u5F84\u6C99\u7BB1\u4FDD\u62A4\uFF09\u3002",
      parameters: {
        generation: {
          type: "string",
          enum: ["v2", "v1"],
          required: true,
          description: 'Codex memory generation ("v2" or "v1").'
        },
        relativePath: {
          type: "string",
          required: true,
          description: 'Relative path such as "rollout_summaries/<slug>.md" or "extensions/ad_hoc/instructions.md".'
        },
        maxBytes: {
          type: "integer",
          description: "Maximum bytes to return (512..131072, default 49152)."
        }
      },
      output: {
        schema: { type: "json" },
        render: renderJsonText
      },
      isConcurrencySafe: () => true,
      presentCall: (args) => ({
        card: "generic",
        kind: "read",
        title: `Read Codex (${args.generation}): ${args.relativePath}`
      }),
      async execute(args) {
        const maxBytes = typeof args.maxBytes === "number" ? Math.max(512, Math.min(131072, args.maxBytes)) : 48 * 1024;
        const result = readCodexMemoryFile(
          args.generation,
          args.relativePath,
          runtime.codexHome,
          maxBytes
        );
        return { readOnly: true, ...result };
      }
    })
  );
}

// src/host/index.ts
var name = "unified-memory";
var inject = ["agents", "tools", "workingDirectory"];
var Config = z.object({
  locale: z.union([z.const("auto"), z.const("zh"), z.const("en")]).default("auto").volatile().description("Display and prompt-header language (auto | zh | en)."),
  injectCodexSummaryOnStart: z.boolean().default(true).volatile().description("Inject read-only Codex memory_summary.md on session baseline."),
  codexSummaryMaxBytes: z.number().min(512).max(65536).default(8192).volatile().description("Maximum byte budget for read-only Codex memory_summary.md injection."),
  injectCodexGlobalAgentsMd: z.boolean().default(false).volatile().description("Also inject ~/.codex/AGENTS.md (or AGENTS.override.md) on startup."),
  deduplicateNativeAgentsMd: z.boolean().default(true).volatile().description("Deduplicate AGENTS.md / host-loaded CLAUDE.md files against dsh-agent-instructions."),
  trustClaudeCodeExternalApprovals: z.boolean().default(true).volatile().description("Reuse existing Claude Code project external-import approvals when present."),
  maxStartupInjectBytes: z.number().min(4096).max(262144).default(65536).volatile().description("Total byte cap for Unified Memory baseline context injection."),
  dataDir: z.string().description("Optional explicit storage directory override (defaults to $DSH_HOME/storages/unified-memory).")
});
function apply(ctx, config) {
  const runtime = createHostRuntime(ctx, config);
  registerContextLifecycle(ctx, runtime);
  registerHostTools(ctx, runtime);
  registerGuidanceSection(ctx);
  registerSlashCommands(ctx, runtime);
  registerBundledSkills(ctx);
  registerHttpRoutes(ctx, runtime);
  ctx.logger.debug("unified-memory host plugin initialized (dataDir=%s)", runtime.dataDir);
}
var index_default = { name, inject, Config, apply };
export {
  Config,
  GUIDANCE_SECTION_NAME,
  UNIFIED_MEMORY_GUIDANCE_TEXT,
  UNIFIED_MEMORY_SOURCE_KIND,
  apply,
  createHostRuntime,
  index_default as default,
  escapeSystemReminder,
  extractFilePathsFromExecution,
  extractHostLoadedPaths,
  inject,
  name,
  wrapSystemReminder
};
