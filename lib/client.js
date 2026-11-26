window.__ModuleLoader__.load({id:"unified-memory-dsh",factory:(require)=>{
var module={exports:{}};
var exports=module.exports;
Object.defineProperty(exports,Symbol.toStringTag,{value:"Module"});
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  CLIENT_LOCALE_DICTS: () => CLIENT_LOCALE_DICTS,
  NS: () => NS,
  PANEL_ID: () => PANEL_ID,
  RIGHT_TAB_ID: () => RIGHT_TAB_ID,
  RIGHT_TAB_KIND: () => RIGHT_TAB_KIND,
  apply: () => apply,
  en: () => en,
  inject: () => inject,
  zh: () => zh
});
module.exports = __toCommonJS(index_exports);

// src/shared/api-contract.ts
var PLUGIN_ID = "unified-memory-dsh";
var PLUGIN_VERSION = "0.1.1";
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

// src/client/components/SessionContextTab.tsx
var import_react = require("react");

// src/client/api.ts
var UnifiedMemoryApiError = class extends Error {
  status;
  code;
  constructor(message, status, code) {
    super(message);
    this.name = "UnifiedMemoryApiError";
    this.status = status;
    this.code = code;
  }
};
function buildRelativeUrl(route, query) {
  const normalized = route.replace(/^\/+/, "");
  if (!query) return normalized;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== void 0 && v !== null && String(v).length > 0) {
      params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return qs ? `${normalized}?${qs}` : normalized;
}
async function parseJsonResponse(res) {
  const text = await res.text();
  let parsed = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      if (!res.ok) {
        throw new UnifiedMemoryApiError(
          `HTTP ${res.status}: ${text.slice(0, 240)}`,
          res.status
        );
      }
      throw new UnifiedMemoryApiError("Invalid JSON response from Unified Memory host", res.status);
    }
  }
  if (!res.ok) {
    const errObj = parsed;
    const msg = typeof errObj?.error === "string" && errObj.error.length > 0 ? errObj.error : `HTTP ${res.status}`;
    throw new UnifiedMemoryApiError(msg, res.status, errObj?.code);
  }
  return parsed;
}
async function apiGet(route, query, signal) {
  const url = buildRelativeUrl(route, query);
  const res = await fetch(url, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal
  });
  return parseJsonResponse(res);
}
async function apiPost(route, body, signal) {
  const url = buildRelativeUrl(route);
  const res = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body ?? {}),
    signal
  });
  return parseJsonResponse(res);
}
var unifiedMemoryApi = {
  getOverview(cwd, signal) {
    return apiGet(API_ROUTES.OVERVIEW, { cwd }, signal);
  },
  resolveClaudeProject(inputPath, signal) {
    return apiGet(API_ROUTES.CLAUDE_RESOLVE, { path: inputPath }, signal);
  },
  listClaudeMemories(params, signal) {
    return apiGet(API_ROUTES.CLAUDE_LIST, params, signal);
  },
  readClaudeMemory(params, signal) {
    return apiGet(API_ROUTES.CLAUDE_READ, params, signal);
  },
  saveClaudeTopic(body, signal) {
    return apiPost(API_ROUTES.CLAUDE_SAVE, body, signal);
  },
  deleteClaudeTopic(body, signal) {
    return apiPost(API_ROUTES.CLAUDE_DELETE, body, signal);
  },
  saveClaudeIndex(body, signal) {
    return apiPost(API_ROUTES.CLAUDE_SAVE_INDEX, body, signal);
  },
  getCodexSummary(params, signal) {
    return apiGet(API_ROUTES.CODEX_SUMMARY, params, signal);
  },
  browseCodex(generation = "auto", signal) {
    return apiGet(API_ROUTES.CODEX_BROWSE, { generation }, signal);
  },
  searchCodex(body, signal) {
    return apiPost(API_ROUTES.CODEX_SEARCH, body, signal);
  },
  readCodexFile(params, signal) {
    return apiGet(API_ROUTES.CODEX_READ, params, signal);
  },
  inspectRules(params, signal) {
    return apiGet(API_ROUTES.RULES_INSPECT, params, signal);
  },
  updateConfig(body, signal) {
    return apiPost(API_ROUTES.CONFIG_UPDATE, body, signal);
  },
  updateTrust(body, signal) {
    return apiPost(API_ROUTES.TRUST_UPDATE, body, signal);
  },
  clearDiagnostics(signal) {
    return apiPost(API_ROUTES.DIAGNOSTICS_CLEAR, {}, signal);
  },
  getSessionContext(sessionId, signal) {
    return apiGet(API_ROUTES.SESSION_CONTEXT, { sessionId }, signal);
  }
};

// src/client/i18n.ts
var CLIENT_LOCALE_NS = "unified-memory";
var en = {
  // Navigation & shell
  "locale.code": "en",
  "panel.navLabel": "Memory",
  "panel.title": "Unified Memory",
  "panel.subtitle": "Claude Code Auto Memory (RW) \xB7 Codex CLI Memory (RO) \xB7 Rules & Trust",
  "panel.sync": "Sync",
  "panel.syncing": "Syncing...",
  "panel.loading": "Loading memory & rules inventory...",
  "panel.dismiss": "Dismiss",
  "panel.errorLoad": "Failed to load Unified Memory overview: {message}",
  // Tabs
  "tabs.ariaLabel": "Unified Memory Views",
  "tabs.overview": "Overview & Diagnostics",
  "tabs.claude": "Claude Memory ({count})",
  "tabs.codex": "Codex Memory (RO)",
  "tabs.rules": "Rules & Context",
  // Common labels & actions
  "common.yes": "Yes",
  "common.no": "No",
  "common.refresh": "Refresh",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.saving": "Saving...",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "common.confirmDelete": "Confirm Delete",
  "common.close": "Close",
  "common.read": "Read",
  "common.hide": "Hide",
  "common.preview": "Preview",
  "common.none": "None",
  "common.unset": "unset",
  "common.loading": "Loading...",
  "common.unknownError": "Unknown error",
  // Overview tab
  "overview.claudeTitle": "Claude Code Memory",
  "overview.claudeReady": "Read-Write Ready",
  "overview.claudeMissing": "Not Found",
  "overview.configDir": "Config Dir",
  "overview.projects": "Projects",
  "overview.projectsSummary": "{projects} projects \xB7 {topics} topic notes",
  "overview.globalFiles": "Global Files",
  "overview.writeSchema": "Write Schema",
  "overview.writeSchemaVal": "v2.1.x nested metadata",
  "overview.codexTitle": "OpenAI Codex Memory",
  "overview.codexReadOnly": "Read-Only ({gen})",
  "overview.codexMissing": "Not Found",
  "overview.codexHome": "Codex Home",
  "overview.activeStore": "Active Store",
  "overview.codexActiveSummary": "{gen} \xB7 summary {bytes} ({lines}L) \xB7 {rollouts} rollouts",
  "overview.codexNoDir": "No memories directory detected",
  "overview.generations": "Generations",
  "overview.configFlags": "Config Flags",
  "overview.resolverTitle": "Project Slug & Worktree Resolver",
  "overview.resolverSubtitle": "Verify exact Claude Code directory mapping",
  "overview.resolverPlaceholder": "/path/to/your/repository",
  "overview.resolve": "Resolve",
  "overview.resolving": "Resolving...",
  "overview.mainRepoRoot": "Main Repo Root",
  "overview.worktreeBadge": "Git Worktree \u2192 Main Repo",
  "overview.encodedSlug": "Encoded Slug",
  "overview.memoryDir": "Memory Dir",
  "overview.dirExists": "Exists",
  "overview.dirWillCreate": "Will create on first save",
  "overview.openInClaudeTab": "Open in Claude Memory",
  "overview.inspectRulesForWorkspace": "Inspect Rules",
  "overview.settingsTitle": "Injection & Localization Settings",
  "overview.settingsSubtitle": "Persisted in {dir}/config.json",
  "overview.settingsSaved": "Settings saved.",
  "overview.localeLabel": "Plugin Language (Host Context & Commands)",
  "overview.localeDesc": "Effective locale: {resolved} \xB7 DSH UI preference: {hostPref}",
  "overview.localeAuto": "Auto (Follow DSH / System)",
  "overview.localeZh": "\u7B80\u4F53\u4E2D\u6587 (zh)",
  "overview.localeEn": "English (en)",
  "overview.codexStartLabel": "Inject Codex Global Memory Summary on Session Start",
  "overview.codexStartDesc": "Loads truncated read-only summary from memories_v2 (fallback memories).",
  "overview.codexBudgetLabel": "Codex Summary Startup Budget",
  "overview.codexBudgetDesc": "Caps global Codex summary size in baseline injection.",
  "overview.maxStartupBudgetLabel": "Max Total Baseline Injection Budget",
  "overview.maxStartupBudgetDesc": "Soft cap for combined rules + MEMORY.md + Codex startup injection.",
  "overview.dedupLabel": "Deduplicate Native Workspace Rules",
  "overview.dedupDesc": "Skips duplicating AGENTS.md and raw CLAUDE.md bodies already loaded by dsh-agent-instructions while still expanding @imports.",
  "overview.reuseApprovalsLabel": "Reuse Claude Code External Import Approvals (~/.claude.json)",
  "overview.reuseApprovalsDesc": "Read-only interop: honors projects already approved in Claude Code. Unapproved external @imports and rule symlinks stay blocked until approved in Rules & Context.",
  "overview.codexGlobalAgentsLabel": "Also Inject Global ~/.codex/AGENTS.md",
  "overview.codexGlobalAgentsDesc": "Optional global Codex instructions (or AGENTS.override.md) on session start.",
  "overview.sessionsTitle": "Active & Recent Sessions ({active} active \xB7 {recent} recent)",
  "overview.sessionsSubtitle": "Per-session baseline, locale, and compaction status",
  "overview.sessionsEmpty": "No sessions tracked yet. Start a conversation to see live memory injection telemetry.",
  "overview.sessionActive": "Live",
  "overview.sessionRecent": "Recent",
  "overview.sessionBaselineOn": "Baseline Injected",
  "overview.sessionBaselineOff": "Pending",
  "overview.sessionCompactions": "compactions: {count}",
  "overview.sessionDeduped": "host-deduped: {count}",
  "overview.sessionInspectRules": "Inspect Rules",
  "overview.diagnosticsTitle": "Recent Hook & Pre-Step Activity ({count})",
  "overview.clearLog": "Clear Log",
  "overview.logCleared": "Diagnostic log cleared.",
  "overview.diagnosticsEmpty": "No pre-step or tool events recorded yet. Start a conversation or read a file matching a scoped rule to see live injections here.",
  "overview.compactionReload": "Compaction Reload",
  "overview.hostDedupedCount": "host-deduped {count}",
  "overview.errorPrefix": "Error: {error}",
  // Claude Memory tab
  "claude.noProjects": "No Claude projects found",
  "claude.projectOption": "{path} ({count} topics)",
  "claude.projectOptionNew": "{path} (new / unindexed)",
  "claude.newTopic": "+ New Topic",
  "claude.indexTitle": "MEMORY.md Startup Index",
  "claude.indexTruncated": "Truncated at {lines}L / {kb} KB",
  "claude.indexWithinCap": "Within Startup Cap",
  "claude.closeEditor": "Close Editor",
  "claude.editIndex": "Edit MEMORY.md",
  "claude.saveIndex": "Save MEMORY.md",
  "claude.indexSaved": "MEMORY.md saved atomically.",
  "claude.linesLabel": "Lines",
  "claude.sizeLabel": "Size",
  "claude.noIndexYet": "No MEMORY.md yet \u2014 creating a topic note will generate it automatically.",
  "claude.topicsTitle": "Topic Notes ({count})",
  "claude.filterAll": "All",
  "claude.type.user": "user",
  "claude.type.feedback": "feedback",
  "claude.type.project": "project",
  "claude.type.reference": "reference",
  "claude.typeDesc.user": "User role, expertise, preferences, communication style",
  "claude.typeDesc.feedback": "Explicit user corrections, constraints, confirmed patterns",
  "claude.typeDesc.project": "Ongoing work context, goals, architectural decisions not in git",
  "claude.typeDesc.reference": "Pointers to external dashboards, docs, issue trackers",
  "claude.searchPlaceholder": "Filter topics by title, description, filename, or content...",
  "claude.loadingProject": "Loading project memories...",
  "claude.noMatchingTopics": "No topic memories match the current filter.",
  "claude.schemaNested": "v2.1 metadata",
  "claude.schemaFlat": "flat frontmatter",
  "claude.schemaNone": "plain markdown",
  "claude.modifiedAt": "modified {ts}",
  "claude.modalNewTitle": "New Claude Memory Topic",
  "claude.modalEditTitle": "Edit {filename}",
  "claude.modalSchemaBadge": "v2.1.x metadata schema",
  "claude.fieldType": "Type",
  "claude.fieldName": "Name (Title / Slug)",
  "claude.fieldNamePlaceholder": "e.g. feedback-no-db-mocks or \u4E2D\u6587\u6807\u9898",
  "claude.fieldFilename": "Filename (optional \u2014 auto-derived, CJK-safe)",
  "claude.fieldFilenamePlaceholder": "feedback_no_db_mocks.md",
  "claude.fieldDescription": "Description (one-line hook shown in MEMORY.md index)",
  "claude.fieldDescriptionPlaceholder": "Concise summary for recall matching",
  "claude.fieldBody": "Body (Markdown)",
  "claude.fieldBodyPlaceholder": "Record the decision, why it matters, and how to apply it...",
  "claude.saveAndSync": "Save & Sync MEMORY.md",
  "claude.topicSaved": "Topic saved & MEMORY.md synced (v2.1.x metadata schema).",
  "claude.topicSavedWarn": "Saved with warning: {warning}",
  "claude.topicDeleted": "Deleted {filename}.",
  "claude.autoMemoryDisabled": "Claude autoMemoryEnabled is disabled in settings for this project.",
  // Codex Memory (RO) tab
  "codex.roBannerTitle": "Strictly Read-Only Mode:",
  "codex.roBannerBody": "Codex memories are generated by codex-rs/memories (SQLite + internal .git). Writes are disabled to prevent consolidation conflicts.",
  "codex.genAuto": "Auto ({gen})",
  "codex.genV2": "memories_v2",
  "codex.genV1": "memories v1",
  "codex.absent": " (absent)",
  "codex.viewSummary": "Summary",
  "codex.viewFiles": "Files ({count})",
  "codex.viewSearch": "Search ({count})",
  "codex.searchPlaceholder": "Search rollouts, extensions, skills, v1 MEMORY.md (CJK & English)...",
  "codex.projectBoostPlaceholder": "Project boost (optional)",
  "codex.searchBtn": "Search",
  "codex.searching": "Searching...",
  "codex.closeViewer": "Close Viewer",
  "codex.truncated": "Truncated",
  "codex.noSummary": "No memory_summary.md found in this generation.",
  "codex.filesTitle": "Files in {dir} ({count})",
  "codex.noFiles": "No readable markdown files found.",
  "codex.searchResultsTitle": "Search Results ({count})",
  "codex.searchEmpty": "Enter keywords above and click Search to query across Codex v2 + v1 memories.",
  "codex.score": "score {score}",
  "codex.cat.summary": "summary",
  "codex.cat.handbook": "MEMORY.md",
  "codex.cat.extension": "extensions",
  "codex.cat.rollout": "rollouts",
  "codex.cat.skill": "skills",
  // Rules & Context tab
  "rules.inspectorTitle": "CLAUDE.md & .claude/rules Inspector",
  "rules.workspacePlaceholder": "/path/to/workspace",
  "rules.inspect": "Inspect",
  "rules.scanning": "Scanning...",
  "rules.globalTitle": "Global Rules ({count})",
  "rules.globalSubtitle": "Managed + ~/.claude/CLAUDE.md + ~/.claude/rules/",
  "rules.globalEmpty": "No global CLAUDE.md or ~/.claude/rules/ files found.",
  "rules.workspaceTitle": "Workspace Rules ({alwaysOn} always-on \xB7 {conditional} path-scoped)",
  "rules.workspaceEmpty": "No CLAUDE.md, CLAUDE.local.md, or .claude/rules/ files found in this workspace.",
  "rules.excludedTitle": "Excluded by claudeMdExcludes:",
  "rules.badgePathScoped": "path-scoped",
  "rules.badgeAlwaysOn": "always-on",
  "rules.badgeHostDeduped": "Host-Deduped (dsh-agent-instructions)",
  "rules.badgeImportsExpanded": "@imports expanded by Unified Memory",
  "rules.badgeLoadedByUm": "Loaded by Unified Memory",
  "rules.badgeDedupedAgents": "Deduped native AGENTS.md ({count})",
  "rules.badgeBlockedExternal": "Blocked external targets ({count})",
  "rules.pathsLabel": "paths:",
  "rules.importsLabel": "@imports ({count}):",
  "rules.importedOnlyNote": "Raw file body is already injected by dsh-agent-instructions; only expanded @imports below are added by Unified Memory:",
  "rules.fullContentNote": "Full resolved content:",
  "rules.trustTitle": "External Imports & Rule Symlinks Trust",
  "rules.trustSubtitle": "User-only controls \xB7 Repo rules outside workspace stay blocked unless trusted",
  "rules.claudeCodeApprovedActive": "Claude Code: Approved (~/.claude.json, active)",
  "rules.claudeCodeApprovedIgnored": "Claude Code: Approved (~/.claude.json, ignored by setting)",
  "rules.claudeCodeDeclined": "Claude Code: Declined (~/.claude.json)",
  "rules.claudeCodeNotApproved": "Claude Code: Not approved",
  "rules.noExternalTargets": "No external @imports or rule symlinks detected in this workspace. When a repository rule points outside this workspace, it will appear here for one-click approval or dismissal.",
  "rules.blockedTitle": "Blocked external targets ({count}):",
  "rules.activeApprovedTitle": "Active external targets loaded ({count}):",
  "rules.savedOverridesTitle": "Saved plugin trust overrides for this workspace:",
  "rules.clearAllOverrides": "Clear All Overrides",
  "rules.approveFile": "Approve File",
  "rules.approveDir": "Approve Dir",
  "rules.approveParentDir": "Approve Parent Dir",
  "rules.dismissTarget": "Dismiss",
  "rules.resetTarget": "Reset",
  "rules.blockTarget": "Block",
  "rules.revokeTarget": "Revoke",
  "rules.allowBadge": "allow",
  "rules.denyBadge": "deny",
  "rules.targetPrefix": "Target: {target}",
  "rules.manualPlaceholder": "~/notes/writing-style.md or ~/shared-rules",
  "rules.allowPathBtn": "+ Allow Path",
  "rules.denyPathBtn": "+ Deny Path",
  "rules.kind.external_import": "@import",
  "rules.kind.external_rule_symlink": "rule symlink",
  "rules.kind.external_rule_dir_symlink": "dir symlink",
  "rules.blockStatus.pending_approval": "pending approval",
  "rules.blockStatus.denied_by_plugin": "dismissed",
  "rules.blockStatus.denied_by_claude_code": "declined in Claude Code",
  "rules.approvalSource.claude_code_project_approval": "Claude Code (~/.claude.json)",
  "rules.approvalSource.plugin_dir_allowlist": "allowed dir",
  "rules.approvalSource.plugin_file_allowlist": "allowed file",
  "rules.trustApprovedToast": "Approved external target. Takes effect on next session or /compact.",
  "rules.trustDeniedToast": "Denied external target. Suppressed from startup notices.",
  "rules.trustUpdatedToast": "Updated workspace external rule trust.",
  "rules.lazyHitsTitle": "Recent Session Lazy-Load Hits ({count})",
  "rules.lazyHitsSubtitle": "tools/result \u2192 agent/pre-step dynamic injections",
  "rules.lazyHitsEmpty": "No path-scoped rules or subdirectory CLAUDE.md files triggered yet.",
  "rules.hitRulePrefix": "rule: {key}",
  "rules.hitSubdirPrefix": "subdir: {key}",
  // Right sidebar per-session tab
  "rightTab.title": "Memory Context",
  "rightTab.guideTitle": "Memory Context",
  "rightTab.guideDescription": "Inspect active session rules, MEMORY.md budget, dedup, and compaction reloads",
  "rightTab.openConsole": "Console",
  "rightTab.noSession": "No active session selected.",
  "rightTab.notYetInjected": "No baseline injected for this session yet. Send a message to trigger Unified Memory on the first agent step.",
  "rightTab.cwd": "Workspace",
  "rightTab.slug": "Claude Slug",
  "rightTab.locale": "Session Locale",
  "rightTab.baseline": "Baseline",
  "rightTab.baselineInjected": "Injected ({bytes})",
  "rightTab.baselinePending": "Pending",
  "rightTab.ruleLoaded": "Loaded",
  "rightTab.ruleStandby": "Standby",
  "rightTab.compactions": "Compactions",
  "rightTab.replaceGen": "Surface Gen #{gen}",
  "rightTab.hostDedup": "dsh-agent-instructions",
  "rightTab.hostDedupActive": "Active ({count} deduped)",
  "rightTab.hostDedupInactive": "Inactive (full takeover)",
  "rightTab.memoryIndex": "MEMORY.md Budget",
  "rightTab.codexInjected": "Codex Summary",
  "rightTab.pendingExternal": "{count} external target(s) awaiting approval",
  "rightTab.sectionInjected": "Injected Context ({count})",
  "rightTab.sectionHostDeduped": "Host-Deduped Files ({count})",
  "rightTab.sectionAlwaysOn": "Loaded Always-On Rules ({count})",
  "rightTab.sectionLazySubdirs": "Triggered Subdir CLAUDE.md ({count})",
  "rightTab.sectionConditional": "Indexed Path-Scoped Rules ({count})",
  "rightTab.updatedAt": "Updated {ts}",
  "rightTab.originFork": "Subagent Fork (KV-cache shared)",
  "rightTab.originSubagent": "Subagent",
  "rightTab.originRoot": "Root Session"
};
var zh = {
  // Navigation & shell
  "locale.code": "zh",
  "panel.navLabel": "\u7EDF\u4E00\u8BB0\u5FC6",
  "panel.title": "\u7EDF\u4E00\u8BB0\u5FC6",
  "panel.subtitle": "Claude Code \u81EA\u52A8\u8BB0\u5FC6\uFF08\u8BFB\u5199\uFF09\xB7 Codex \u8BB0\u5FC6\uFF08\u53EA\u8BFB\uFF09\xB7 \u89C4\u5219\u4E0E\u4FE1\u4EFB",
  "panel.sync": "\u540C\u6B65",
  "panel.syncing": "\u540C\u6B65\u4E2D...",
  "panel.loading": "\u6B63\u5728\u52A0\u8F7D\u8BB0\u5FC6\u4E0E\u89C4\u5219\u6E05\u5355...",
  "panel.dismiss": "\u5173\u95ED",
  "panel.errorLoad": "\u52A0\u8F7D\u7EDF\u4E00\u8BB0\u5FC6\u603B\u89C8\u5931\u8D25\uFF1A{message}",
  // Tabs
  "tabs.ariaLabel": "\u7EDF\u4E00\u8BB0\u5FC6\u89C6\u56FE",
  "tabs.overview": "\u603B\u89C8\u4E0E\u8BCA\u65AD",
  "tabs.claude": "Claude \u8BB0\u5FC6 ({count})",
  "tabs.codex": "Codex \u8BB0\u5FC6\uFF08\u53EA\u8BFB\uFF09",
  "tabs.rules": "\u89C4\u5219\u4E0E\u4E0A\u4E0B\u6587",
  // Common labels & actions
  "common.yes": "\u662F",
  "common.no": "\u5426",
  "common.refresh": "\u5237\u65B0",
  "common.cancel": "\u53D6\u6D88",
  "common.save": "\u4FDD\u5B58",
  "common.saving": "\u4FDD\u5B58\u4E2D...",
  "common.edit": "\u7F16\u8F91",
  "common.delete": "\u5220\u9664",
  "common.confirmDelete": "\u786E\u8BA4\u5220\u9664",
  "common.close": "\u5173\u95ED",
  "common.read": "\u5C55\u5F00",
  "common.hide": "\u6536\u8D77",
  "common.preview": "\u9884\u89C8",
  "common.none": "\u65E0",
  "common.unset": "\u672A\u8BBE\u7F6E",
  "common.loading": "\u52A0\u8F7D\u4E2D...",
  "common.unknownError": "\u672A\u77E5\u9519\u8BEF",
  // Overview tab
  "overview.claudeTitle": "Claude Code \u8BB0\u5FC6",
  "overview.claudeReady": "\u53EF\u8BFB\u5199\u5C31\u7EEA",
  "overview.claudeMissing": "\u672A\u627E\u5230",
  "overview.configDir": "\u914D\u7F6E\u76EE\u5F55",
  "overview.projects": "\u9879\u76EE\u6570",
  "overview.projectsSummary": "{projects} \u4E2A\u9879\u76EE \xB7 {topics} \u6761\u4E3B\u9898\u7B14\u8BB0",
  "overview.globalFiles": "\u5168\u5C40\u6587\u4EF6",
  "overview.writeSchema": "\u5199\u5165\u683C\u5F0F",
  "overview.writeSchemaVal": "v2.1.x \u5D4C\u5957\u5143\u6570\u636E",
  "overview.codexTitle": "OpenAI Codex \u8BB0\u5FC6",
  "overview.codexReadOnly": "\u53EA\u8BFB ({gen})",
  "overview.codexMissing": "\u672A\u627E\u5230",
  "overview.codexHome": "Codex \u76EE\u5F55",
  "overview.activeStore": "\u5F53\u524D\u5B58\u50A8",
  "overview.codexActiveSummary": "{gen} \xB7 \u6458\u8981 {bytes} ({lines} \u884C) \xB7 {rollouts} \u6761\u56DE\u653E",
  "overview.codexNoDir": "\u672A\u68C0\u6D4B\u5230 Codex \u8BB0\u5FC6\u76EE\u5F55",
  "overview.generations": "\u7248\u672C\u4EE3\u9645",
  "overview.configFlags": "\u914D\u7F6E\u6807\u5FD7",
  "overview.resolverTitle": "\u9879\u76EE Slug \u4E0E Git Worktree \u89E3\u6790\u5668",
  "overview.resolverSubtitle": "\u9A8C\u8BC1\u7CBE\u786E\u7684 Claude Code \u9879\u76EE\u8BB0\u5FC6\u76EE\u5F55\u6620\u5C04",
  "overview.resolverPlaceholder": "/path/to/your/repository",
  "overview.resolve": "\u89E3\u6790",
  "overview.resolving": "\u89E3\u6790\u4E2D...",
  "overview.mainRepoRoot": "\u4E3B\u4ED3\u5E93\u6839\u76EE\u5F55",
  "overview.worktreeBadge": "Git Worktree \u2192 \u4E3B\u4ED3\u5E93",
  "overview.encodedSlug": "\u7F16\u7801 Slug",
  "overview.memoryDir": "\u8BB0\u5FC6\u76EE\u5F55",
  "overview.dirExists": "\u5DF2\u5B58\u5728",
  "overview.dirWillCreate": "\u9996\u6B21\u4FDD\u5B58\u65F6\u81EA\u52A8\u521B\u5EFA",
  "overview.openInClaudeTab": "\u5728 Claude \u8BB0\u5FC6\u4E2D\u6253\u5F00",
  "overview.inspectRulesForWorkspace": "\u68C0\u67E5\u5DE5\u4F5C\u533A\u89C4\u5219",
  "overview.settingsTitle": "\u6CE8\u5165\u4E0E\u8BED\u8A00\u8BBE\u7F6E",
  "overview.settingsSubtitle": "\u6301\u4E45\u5316\u4E8E {dir}/config.json",
  "overview.settingsSaved": "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\u3002",
  "overview.localeLabel": "\u63D2\u4EF6\u8BED\u8A00\uFF08\u5BBF\u4E3B\u6CE8\u5165\u6A2A\u5E45\u4E0E\u659C\u6760\u547D\u4EE4\uFF09",
  "overview.localeDesc": "\u5F53\u524D\u751F\u6548\u8BED\u8A00\uFF1A{resolved} \xB7 DSH \u754C\u9762\u8BED\u8A00\u504F\u597D\uFF1A{hostPref}",
  "overview.localeAuto": "\u81EA\u52A8\uFF08\u8DDF\u968F DSH / \u7CFB\u7EDF\uFF09",
  "overview.localeZh": "\u7B80\u4F53\u4E2D\u6587 (zh)",
  "overview.localeEn": "English (en)",
  "overview.codexStartLabel": "\u4F1A\u8BDD\u542F\u52A8\u65F6\u6CE8\u5165 Codex \u5168\u5C40\u8BB0\u5FC6\u6458\u8981",
  "overview.codexStartDesc": "\u4ECE memories_v2\uFF08\u6216\u56DE\u9000 memories\uFF09\u52A0\u8F7D\u622A\u65AD\u540E\u7684\u53EA\u8BFB\u6458\u8981\u3002",
  "overview.codexBudgetLabel": "Codex \u542F\u52A8\u6458\u8981\u5B57\u8282\u4E0A\u9650",
  "overview.codexBudgetDesc": "\u9650\u5236\u57FA\u7EBF\u6CE8\u5165\u4E2D\u5168\u5C40 Codex \u6458\u8981\u7684\u6700\u5927\u4F53\u79EF\u3002",
  "overview.maxStartupBudgetLabel": "\u57FA\u7EBF\u6CE8\u5165\u603B\u5B57\u8282\u4E0A\u9650",
  "overview.maxStartupBudgetDesc": "\u89C4\u5219\u3001MEMORY.md \u4E0E Codex \u6458\u8981\u5408\u8BA1\u7684\u542F\u52A8\u8F6F\u4E0A\u9650\u3002",
  "overview.dedupLabel": "\u53BB\u91CD\u5BBF\u4E3B\u539F\u751F\u5DE5\u4F5C\u533A\u89C4\u5219",
  "overview.dedupDesc": "\u8DF3\u8FC7\u5DF2\u88AB dsh-agent-instructions \u52A0\u8F7D\u7684 AGENTS.md \u548C\u88F8 CLAUDE.md \u6B63\u6587\uFF0C\u4F46\u4ECD\u5C55\u5F00\u5176\u4E2D\u7684 @import\u3002",
  "overview.reuseApprovalsLabel": "\u590D\u7528 Claude Code \u5916\u90E8\u5BFC\u5165\u6388\u6743\uFF08~/.claude.json\uFF09",
  "overview.reuseApprovalsDesc": "\u53EA\u8BFB\u4E92\u901A\uFF1A\u5C0A\u91CD\u5DF2\u5728 Claude Code \u4E2D\u6279\u51C6\u7684\u9879\u76EE\u3002\u672A\u6388\u6743\u7684\u5916\u90E8 @import \u4E0E\u89C4\u5219\u7B26\u53F7\u94FE\u63A5\u4FDD\u6301\u62E6\u622A\uFF0C\u76F4\u5230\u5728\u201C\u89C4\u5219\u4E0E\u4E0A\u4E0B\u6587\u201D\u4E2D\u6279\u51C6\u3002",
  "overview.codexGlobalAgentsLabel": "\u540C\u65F6\u6CE8\u5165\u5168\u5C40 ~/.codex/AGENTS.md",
  "overview.codexGlobalAgentsDesc": "\u53EF\u9009\uFF1A\u4F1A\u8BDD\u542F\u52A8\u65F6\u6CE8\u5165\u5168\u5C40 Codex \u6307\u4EE4\uFF08\u6216 AGENTS.override.md\uFF09\u3002",
  "overview.sessionsTitle": "\u6D3B\u8DC3\u4E0E\u6700\u8FD1\u4F1A\u8BDD\uFF08{active} \u6D3B\u8DC3 \xB7 {recent} \u6700\u8FD1\uFF09",
  "overview.sessionsSubtitle": "\u6309\u4F1A\u8BDD\u5C55\u793A\u57FA\u7EBF\u6CE8\u5165\u3001\u8BED\u8A00\u4E0E\u538B\u5B9E\u91CD\u8F7D\u72B6\u6001",
  "overview.sessionsEmpty": "\u5C1A\u672A\u8BB0\u5F55\u4EFB\u4F55\u4F1A\u8BDD\u3002\u5F00\u542F\u5BF9\u8BDD\u540E\u5373\u53EF\u5728\u6B64\u67E5\u770B\u5B9E\u65F6\u6CE8\u5165\u9065\u6D4B\u3002",
  "overview.sessionActive": "\u6D3B\u8DC3",
  "overview.sessionRecent": "\u5386\u53F2",
  "overview.sessionBaselineOn": "\u57FA\u7EBF\u5DF2\u6CE8\u5165",
  "overview.sessionBaselineOff": "\u5F85\u6CE8\u5165",
  "overview.sessionCompactions": "\u538B\u5B9E\u91CD\u8F7D: {count}",
  "overview.sessionDeduped": "\u5BBF\u4E3B\u53BB\u91CD: {count}",
  "overview.sessionInspectRules": "\u67E5\u770B\u89C4\u5219",
  "overview.diagnosticsTitle": "\u8FD1\u671F Hook / Pre-Step \u8BCA\u65AD\u8BB0\u5F55 ({count})",
  "overview.clearLog": "\u6E05\u7A7A\u65E5\u5FD7",
  "overview.logCleared": "\u8BCA\u65AD\u65E5\u5FD7\u5DF2\u6E05\u7A7A\u3002",
  "overview.diagnosticsEmpty": "\u5C1A\u65E0\u9884\u6B65\u9AA4\u6216\u5DE5\u5177\u89E6\u53D1\u8BB0\u5F55\u3002\u53D1\u8D77\u5BF9\u8BDD\u6216\u8BFB\u53D6\u547D\u4E2D\u8DEF\u5F84\u89C4\u5219\u7684\u6587\u4EF6\u540E\u5C06\u5728\u6B64\u663E\u793A\u3002",
  "overview.compactionReload": "\u538B\u5B9E\u540E\u91CD\u8F7D",
  "overview.hostDedupedCount": "\u5BBF\u4E3B\u53BB\u91CD {count}",
  "overview.errorPrefix": "\u9519\u8BEF\uFF1A{error}",
  // Claude Memory tab
  "claude.noProjects": "\u672A\u53D1\u73B0 Claude \u9879\u76EE",
  "claude.projectOption": "{path}\uFF08{count} \u6761\u7B14\u8BB0\uFF09",
  "claude.projectOptionNew": "{path}\uFF08\u65B0\u5EFA / \u5C1A\u672A\u5EFA\u6863\uFF09",
  "claude.newTopic": "+ \u65B0\u5EFA\u4E3B\u9898",
  "claude.indexTitle": "MEMORY.md \u542F\u52A8\u7D22\u5F15",
  "claude.indexTruncated": "\u5DF2\u8D85\u8FC7 {lines} \u884C / {kb} KB \u4E0A\u9650\u5E76\u622A\u65AD",
  "claude.indexWithinCap": "\u5904\u4E8E\u542F\u52A8\u9884\u7B97\u5185",
  "claude.closeEditor": "\u5173\u95ED\u7F16\u8F91\u5668",
  "claude.editIndex": "\u7F16\u8F91 MEMORY.md",
  "claude.saveIndex": "\u4FDD\u5B58 MEMORY.md",
  "claude.indexSaved": "MEMORY.md \u5DF2\u539F\u5B50\u5199\u5165\u3002",
  "claude.linesLabel": "\u884C\u6570",
  "claude.sizeLabel": "\u4F53\u79EF",
  "claude.noIndexYet": "\u5C1A\u65E0 MEMORY.md \u2014\u2014 \u521B\u5EFA\u4EFB\u610F\u4E3B\u9898\u7B14\u8BB0\u540E\u4F1A\u81EA\u52A8\u751F\u6210\u3002",
  "claude.topicsTitle": "\u4E3B\u9898\u7B14\u8BB0 ({count})",
  "claude.filterAll": "\u5168\u90E8",
  "claude.type.user": "user\uFF08\u7528\u6237\uFF09",
  "claude.type.feedback": "feedback\uFF08\u53CD\u9988\uFF09",
  "claude.type.project": "project\uFF08\u9879\u76EE\uFF09",
  "claude.type.reference": "reference\uFF08\u53C2\u8003\uFF09",
  "claude.typeDesc.user": "\u7528\u6237\u89D2\u8272\u3001\u4E13\u4E1A\u80CC\u666F\u3001\u504F\u597D\u4E0E\u6C9F\u901A\u98CE\u683C",
  "claude.typeDesc.feedback": "\u7528\u6237\u660E\u786E\u7EA0\u6B63\u3001\u786C\u7EA6\u675F\u4E0E\u5DF2\u786E\u8BA4\u6A21\u5F0F",
  "claude.typeDesc.project": "\u8FDB\u884C\u4E2D\u7684\u9879\u76EE\u80CC\u666F\u3001\u76EE\u6807\u4E0E\u672A\u5165\u5E93\u67B6\u6784\u51B3\u7B56",
  "claude.typeDesc.reference": "\u5916\u90E8\u770B\u677F\u3001\u6587\u6863\u3001\u7F3A\u9677\u8DDF\u8E2A\u7B49\u5165\u53E3\u6307\u9488",
  "claude.searchPlaceholder": "\u6309\u6807\u9898\u3001\u63CF\u8FF0\u3001\u6587\u4EF6\u540D\u6216\u6B63\u6587\u7B5B\u9009\u4E3B\u9898...",
  "claude.loadingProject": "\u6B63\u5728\u52A0\u8F7D\u9879\u76EE\u8BB0\u5FC6...",
  "claude.noMatchingTopics": "\u5F53\u524D\u7B5B\u9009\u6761\u4EF6\u4E0B\u6CA1\u6709\u5339\u914D\u7684\u4E3B\u9898\u8BB0\u5FC6\u3002",
  "claude.schemaNested": "v2.1 \u5143\u6570\u636E",
  "claude.schemaFlat": "\u6241\u5E73 Frontmatter",
  "claude.schemaNone": "\u7EAF Markdown",
  "claude.modifiedAt": "\u66F4\u65B0\u4E8E {ts}",
  "claude.modalNewTitle": "\u65B0\u5EFA Claude \u8BB0\u5FC6\u4E3B\u9898",
  "claude.modalEditTitle": "\u7F16\u8F91 {filename}",
  "claude.modalSchemaBadge": "v2.1.x \u5143\u6570\u636E\u683C\u5F0F",
  "claude.fieldType": "\u7C7B\u522B (type)",
  "claude.fieldName": "\u540D\u79F0\uFF08\u6807\u9898 / Slug\uFF09",
  "claude.fieldNamePlaceholder": "\u5982 feedback-no-db-mocks \u6216 \u67B6\u6784\u51B3\u7B56-\u6570\u636E\u5E93\u89C4\u8303",
  "claude.fieldFilename": "\u6587\u4EF6\u540D\uFF08\u53EF\u9009\uFF0C\u7559\u7A7A\u81EA\u52A8\u751F\u6210\u5E76\u652F\u6301\u7EAF\u4E2D\u6587\u6807\u9898\uFF09",
  "claude.fieldFilenamePlaceholder": "feedback_no_db_mocks.md",
  "claude.fieldDescription": "\u6458\u8981\u63CF\u8FF0\uFF08\u5355\u884C\u7D22\u5F15\u63D0\u793A\uFF0C\u5199\u5165 MEMORY.md\uFF09",
  "claude.fieldDescriptionPlaceholder": "\u7B80\u660E\u6982\u62EC\u7528\u4E8E\u8DE8\u4F1A\u8BDD\u56DE\u5FC6\u5339\u914D",
  "claude.fieldBody": "\u6B63\u6587\uFF08Markdown\uFF09",
  "claude.fieldBodyPlaceholder": "\u8BB0\u5F55\u7ED3\u8BBA\u3001\u539F\u56E0\u80CC\u666F\u4EE5\u53CA\u540E\u7EED\u5E94\u5982\u4F55\u5E94\u7528...",
  "claude.saveAndSync": "\u4FDD\u5B58\u5E76\u540C\u6B65 MEMORY.md",
  "claude.topicSaved": "\u4E3B\u9898\u5DF2\u4FDD\u5B58\u5E76\u540C\u6B65\u81F3 MEMORY.md\uFF08v2.1.x \u683C\u5F0F\uFF09\u3002",
  "claude.topicSavedWarn": "\u5DF2\u4FDD\u5B58\uFF08\u9644\u8B66\u544A\uFF09\uFF1A{warning}",
  "claude.topicDeleted": "\u5DF2\u5220\u9664 {filename}\u3002",
  "claude.autoMemoryDisabled": "\u8BE5\u9879\u76EE\u5728 Claude \u8BBE\u7F6E\u4E2D\u7981\u7528\u4E86 autoMemoryEnabled\u3002",
  // Codex Memory (RO) tab
  "codex.roBannerTitle": "\u4E25\u683C\u53EA\u8BFB\u6A21\u5F0F\uFF1A",
  "codex.roBannerBody": "Codex \u8BB0\u5FC6\u7531 codex-rs/memories\uFF08SQLite + \u5185\u90E8 .git\uFF09\u7EF4\u62A4\uFF0C\u6B64\u5904\u7981\u7528\u5199\u5165\u4EE5\u907F\u514D\u5408\u5E76\u51B2\u7A81\u3002",
  "codex.genAuto": "\u81EA\u52A8 ({gen})",
  "codex.genV2": "memories_v2",
  "codex.genV1": "memories v1",
  "codex.absent": "\uFF08\u4E0D\u5B58\u5728\uFF09",
  "codex.viewSummary": "\u6458\u8981",
  "codex.viewFiles": "\u6587\u4EF6 ({count})",
  "codex.viewSearch": "\u68C0\u7D22 ({count})",
  "codex.searchPlaceholder": "\u68C0\u7D22\u56DE\u653E\u6458\u8981\u3001extensions\u3001skills\u3001v1 MEMORY.md\uFF08\u652F\u6301\u4E2D\u6587\u4E0E\u82F1\u6587\uFF09...",
  "codex.projectBoostPlaceholder": "\u9879\u76EE\u52A0\u6743\u8BCD\uFF08\u53EF\u9009\uFF09",
  "codex.searchBtn": "\u68C0\u7D22",
  "codex.searching": "\u68C0\u7D22\u4E2D...",
  "codex.closeViewer": "\u5173\u95ED\u9884\u89C8",
  "codex.truncated": "\u5DF2\u622A\u65AD",
  "codex.noSummary": "\u5F53\u524D\u4EE3\u9645\u4E0B\u672A\u627E\u5230 memory_summary.md\u3002",
  "codex.filesTitle": "{dir} \u76EE\u5F55\u4E0B\u7684\u6587\u4EF6 ({count})",
  "codex.noFiles": "\u672A\u627E\u5230\u53EF\u8BFB\u7684 Markdown \u6587\u4EF6\u3002",
  "codex.searchResultsTitle": "\u68C0\u7D22\u7ED3\u679C ({count})",
  "codex.searchEmpty": "\u5728\u4E0A\u65B9\u8F93\u5165\u5173\u952E\u8BCD\u5E76\u70B9\u51FB\u68C0\u7D22\uFF0C\u5373\u53EF\u8DE8 Codex v2 \u4E0E v1 \u8BB0\u5FC6\u641C\u7D22\u3002",
  "codex.score": "\u76F8\u5173\u5EA6 {score}",
  "codex.cat.summary": "\u6458\u8981",
  "codex.cat.handbook": "MEMORY.md",
  "codex.cat.extension": "extensions",
  "codex.cat.rollout": "rollouts",
  "codex.cat.skill": "skills",
  // Rules & Context tab
  "rules.inspectorTitle": "CLAUDE.md \u4E0E .claude/rules \u68C0\u67E5\u5668",
  "rules.workspacePlaceholder": "/path/to/workspace",
  "rules.inspect": "\u68C0\u67E5",
  "rules.scanning": "\u626B\u63CF\u4E2D...",
  "rules.globalTitle": "\u5168\u5C40\u89C4\u5219 ({count})",
  "rules.globalSubtitle": "Managed + ~/.claude/CLAUDE.md + ~/.claude/rules/",
  "rules.globalEmpty": "\u672A\u627E\u5230\u5168\u5C40 CLAUDE.md \u6216 ~/.claude/rules/ \u6587\u4EF6\u3002",
  "rules.workspaceTitle": "\u5DE5\u4F5C\u533A\u89C4\u5219\uFF08{alwaysOn} \u5E38\u9A7B \xB7 {conditional} \u8DEF\u5F84\u6761\u4EF6\uFF09",
  "rules.workspaceEmpty": "\u5F53\u524D\u5DE5\u4F5C\u533A\u672A\u627E\u5230 CLAUDE.md\u3001CLAUDE.local.md \u6216 .claude/rules/ \u6587\u4EF6\u3002",
  "rules.excludedTitle": "\u5DF2\u88AB claudeMdExcludes \u6392\u9664\uFF1A",
  "rules.badgePathScoped": "\u8DEF\u5F84\u6761\u4EF6",
  "rules.badgeAlwaysOn": "\u5E38\u9A7B\u52A0\u8F7D",
  "rules.badgeHostDeduped": "\u5BBF\u4E3B\u5DF2\u53BB\u91CD (dsh-agent-instructions)",
  "rules.badgeImportsExpanded": "@import \u7531\u7EDF\u4E00\u8BB0\u5FC6\u5C55\u5F00",
  "rules.badgeLoadedByUm": "\u7531\u7EDF\u4E00\u8BB0\u5FC6\u52A0\u8F7D",
  "rules.badgeDedupedAgents": "\u5DF2\u53BB\u91CD\u539F\u751F AGENTS.md ({count})",
  "rules.badgeBlockedExternal": "\u5DF2\u62E6\u622A\u5916\u90E8\u76EE\u6807 ({count})",
  "rules.pathsLabel": "paths \u5339\u914D\uFF1A",
  "rules.importsLabel": "@import \u5F15\u7528 ({count})\uFF1A",
  "rules.importedOnlyNote": "\u8BE5\u6587\u4EF6\u539F\u6587\u5DF2\u7531 dsh-agent-instructions \u52A0\u8F7D\uFF1B\u7EDF\u4E00\u8BB0\u5FC6\u4EC5\u589E\u91CF\u6CE8\u5165\u4EE5\u4E0B\u5C55\u5F00\u7684 @import \u5185\u5BB9\uFF1A",
  "rules.fullContentNote": "\u5B8C\u6574\u89E3\u6790\u5185\u5BB9\uFF1A",
  "rules.trustTitle": "\u5916\u90E8 @import \u4E0E\u89C4\u5219\u7B26\u53F7\u94FE\u63A5\u4FE1\u4EFB\u7BA1\u7406",
  "rules.trustSubtitle": "\u4EC5\u7528\u6237\u53EF\u64CD\u4F5C \xB7 \u6307\u5411\u5DE5\u4F5C\u533A\u5916\u90E8\u7684\u4ED3\u5E93\u89C4\u5219\u9ED8\u8BA4\u62E6\u622A\uFF0C\u6279\u51C6\u540E\u65B9\u624D\u52A0\u8F7D",
  "rules.claudeCodeApprovedActive": "Claude Code\uFF1A\u5DF2\u6279\u51C6\uFF08~/.claude.json\uFF0C\u5DF2\u542F\u7528\u590D\u7528\uFF09",
  "rules.claudeCodeApprovedIgnored": "Claude Code\uFF1A\u5DF2\u6279\u51C6\uFF08~/.claude.json\uFF0C\u5F53\u524D\u8BBE\u7F6E\u5DF2\u5FFD\u7565\uFF09",
  "rules.claudeCodeDeclined": "Claude Code\uFF1A\u5DF2\u62D2\u7EDD\uFF08~/.claude.json\uFF09",
  "rules.claudeCodeNotApproved": "Claude Code\uFF1A\u672A\u6279\u51C6",
  "rules.noExternalTargets": "\u5F53\u524D\u5DE5\u4F5C\u533A\u672A\u68C0\u6D4B\u5230\u6307\u5411\u5DE5\u4F5C\u533A\u5916\u7684 @import \u6216\u89C4\u5219\u7B26\u53F7\u94FE\u63A5\u3002\u4E00\u65E6\u53D1\u73B0\uFF0C\u5C06\u5728\u6B64\u63D0\u4F9B\u4E00\u952E\u6279\u51C6\u6216\u5FFD\u7565\u64CD\u4F5C\u3002",
  "rules.blockedTitle": "\u5DF2\u62E6\u622A\u7684\u5916\u90E8\u76EE\u6807 ({count})\uFF1A",
  "rules.activeApprovedTitle": "\u5DF2\u653E\u884C\u5E76\u52A0\u8F7D\u7684\u5916\u90E8\u76EE\u6807 ({count})\uFF1A",
  "rules.savedOverridesTitle": "\u6B64\u5DE5\u4F5C\u533A\u5DF2\u4FDD\u5B58\u7684\u63D2\u4EF6\u4FE1\u4EFB\u89C4\u5219\uFF1A",
  "rules.clearAllOverrides": "\u6E05\u7A7A\u5168\u90E8\u8986\u76D6\u9879",
  "rules.approveFile": "\u6279\u51C6\u6587\u4EF6",
  "rules.approveDir": "\u6279\u51C6\u76EE\u5F55",
  "rules.approveParentDir": "\u6279\u51C6\u7236\u76EE\u5F55",
  "rules.dismissTarget": "\u5FFD\u7565",
  "rules.resetTarget": "\u91CD\u7F6E",
  "rules.blockTarget": "\u62E6\u622A",
  "rules.revokeTarget": "\u64A4\u9500",
  "rules.allowBadge": "\u5141\u8BB8",
  "rules.denyBadge": "\u62D2\u7EDD",
  "rules.targetPrefix": "\u76EE\u6807\u8DEF\u5F84\uFF1A{target}",
  "rules.manualPlaceholder": "~/notes/writing-style.md \u6216 ~/shared-rules",
  "rules.allowPathBtn": "+ \u5141\u8BB8\u8DEF\u5F84",
  "rules.denyPathBtn": "+ \u62D2\u7EDD\u8DEF\u5F84",
  "rules.kind.external_import": "@import",
  "rules.kind.external_rule_symlink": "\u89C4\u5219\u8F6F\u94FE",
  "rules.kind.external_rule_dir_symlink": "\u76EE\u5F55\u8F6F\u94FE",
  "rules.blockStatus.pending_approval": "\u5F85\u6279\u51C6",
  "rules.blockStatus.denied_by_plugin": "\u5DF2\u5FFD\u7565",
  "rules.blockStatus.denied_by_claude_code": "\u5DF2\u5728 Claude Code \u62D2\u7EDD",
  "rules.approvalSource.claude_code_project_approval": "Claude Code (~/.claude.json)",
  "rules.approvalSource.plugin_dir_allowlist": "\u5DF2\u6279\u51C6\u76EE\u5F55",
  "rules.approvalSource.plugin_file_allowlist": "\u5DF2\u6279\u51C6\u6587\u4EF6",
  "rules.trustApprovedToast": "\u5DF2\u6279\u51C6\u8BE5\u5916\u90E8\u76EE\u6807\uFF0C\u5C06\u4E8E\u4E0B\u6B21\u4F1A\u8BDD\u6216 /compact \u751F\u6548\u3002",
  "rules.trustDeniedToast": "\u5DF2\u62D2\u7EDD\u8BE5\u5916\u90E8\u76EE\u6807\uFF0C\u5E76\u6291\u5236\u542F\u52A8\u63D0\u793A\u3002",
  "rules.trustUpdatedToast": "\u5DE5\u4F5C\u533A\u5916\u90E8\u89C4\u5219\u4FE1\u4EFB\u914D\u7F6E\u5DF2\u66F4\u65B0\u3002",
  "rules.lazyHitsTitle": "\u8FD1\u671F\u4F1A\u8BDD\u6309\u9700\u61D2\u52A0\u8F7D\u547D\u4E2D ({count})",
  "rules.lazyHitsSubtitle": "tools/result \u2192 agent/pre-step \u52A8\u6001\u89E6\u53D1\u6CE8\u5165",
  "rules.lazyHitsEmpty": "\u5C1A\u672A\u89E6\u53D1\u8DEF\u5F84\u6761\u4EF6\u89C4\u5219\u6216\u5B50\u76EE\u5F55 CLAUDE.md\u3002",
  "rules.hitRulePrefix": "\u89C4\u5219\uFF1A{key}",
  "rules.hitSubdirPrefix": "\u5B50\u76EE\u5F55\uFF1A{key}",
  // Right sidebar per-session tab
  "rightTab.title": "\u8BB0\u5FC6\u4E0A\u4E0B\u6587",
  "rightTab.guideTitle": "\u8BB0\u5FC6\u4E0A\u4E0B\u6587",
  "rightTab.guideDescription": "\u67E5\u770B\u5F53\u524D\u4F1A\u8BDD\u5DF2\u6CE8\u5165\u89C4\u5219\u3001MEMORY.md \u9884\u7B97\u3001\u5BBF\u4E3B\u53BB\u91CD\u4E0E\u538B\u5B9E\u91CD\u8F7D\u72B6\u6001",
  "rightTab.openConsole": "\u63A7\u5236\u53F0",
  "rightTab.noSession": "\u5F53\u524D\u672A\u9009\u4E2D\u4F1A\u8BDD\u3002",
  "rightTab.notYetInjected": "\u6B64\u4F1A\u8BDD\u5C1A\u672A\u89E6\u53D1\u57FA\u7EBF\u6CE8\u5165\u3002\u53D1\u9001\u7B2C\u4E00\u6761\u6D88\u606F\u540E\uFF0C\u7EDF\u4E00\u8BB0\u5FC6\u5C06\u5728\u9996\u4E2A\u6B65\u9AA4\u81EA\u52A8\u6CE8\u5165\u4E0A\u4E0B\u6587\u3002",
  "rightTab.cwd": "\u5DE5\u4F5C\u533A",
  "rightTab.slug": "Claude Slug",
  "rightTab.locale": "\u4F1A\u8BDD\u8BED\u8A00",
  "rightTab.baseline": "\u57FA\u7EBF\u72B6\u6001",
  "rightTab.baselineInjected": "\u5DF2\u6CE8\u5165 ({bytes})",
  "rightTab.baselinePending": "\u5F85\u6CE8\u5165",
  "rightTab.ruleLoaded": "\u5DF2\u52A0\u8F7D",
  "rightTab.ruleStandby": "\u5F85\u89E6\u53D1",
  "rightTab.compactions": "\u538B\u5B9E\u91CD\u8F7D",
  "rightTab.replaceGen": "\u8868\u9762\u4EE3\u6B21 #{gen}",
  "rightTab.hostDedup": "dsh-agent-instructions",
  "rightTab.hostDedupActive": "\u5DF2\u542F\u7528\uFF08\u53BB\u91CD {count} \u9879\uFF09",
  "rightTab.hostDedupInactive": "\u672A\u542F\u7528\uFF08\u5B8C\u6574\u63A5\u7BA1\uFF09",
  "rightTab.memoryIndex": "MEMORY.md \u9884\u7B97",
  "rightTab.codexInjected": "Codex \u6458\u8981",
  "rightTab.pendingExternal": "{count} \u4E2A\u5916\u90E8\u76EE\u6807\u7B49\u5F85\u7528\u6237\u6279\u51C6",
  "rightTab.sectionInjected": "\u5DF2\u6CE8\u5165\u4E0A\u4E0B\u6587 ({count})",
  "rightTab.sectionHostDeduped": "\u5BBF\u4E3B\u5DF2\u53BB\u91CD\u6587\u4EF6 ({count})",
  "rightTab.sectionAlwaysOn": "\u5E38\u9A7B\u89C4\u5219 ({count})",
  "rightTab.sectionLazySubdirs": "\u5DF2\u89E6\u53D1\u5B50\u76EE\u5F55 CLAUDE.md ({count})",
  "rightTab.sectionConditional": "\u5DF2\u7D22\u5F15\u8DEF\u5F84\u6761\u4EF6\u89C4\u5219 ({count})",
  "rightTab.updatedAt": "\u66F4\u65B0\u4E8E {ts}",
  "rightTab.originFork": "\u5B50\u4EE3\u7406\u5206\u652F\uFF08\u590D\u7528\u7236\u7EA7 KV \u7F13\u5B58\uFF09",
  "rightTab.originSubagent": "\u5B50\u4EE3\u7406\u4F1A\u8BDD",
  "rightTab.originRoot": "\u4E3B\u4F1A\u8BDD"
};
var CLIENT_LOCALE_DICTS = { zh, en };
function createFallbackTranslator(lang = "en") {
  const dict = lang === "zh" ? zh : en;
  return (key, params) => {
    const template = dict[key] ?? en[key] ?? key;
    if (!params) return template;
    return template.replace(
      /\{(\w+)\}/g,
      (match, name) => name in params && params[name] !== void 0 && params[name] !== null ? String(params[name]) : match
    );
  };
}

// src/client/icons.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function MemoryGlyph({
  size = 16,
  className
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.85,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      className,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 3 3 7.5 12 12l9-4.5L12 3Z" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m3 12 9 4.5 9-4.5" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m3 16.5 9 4.5 9-4.5" })
      ]
    }
  );
}
function MemoryPanelIcon({ size }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemoryGlyph, { size });
}
function MemoryGuideIcon({ size = 22, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemoryGlyph, { size, className });
}
function RefreshIcon({ size = 13 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 12a9 9 0 1 1-2.64-6.36" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 3v6h-6" })
      ]
    }
  );
}

// src/client/components/SessionContextTab.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function fmtBytes(bytes) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}
function fmtShortTime(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleTimeString(void 0, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
function SessionContextTitle({ t }) {
  const translate = t ?? createFallbackTranslator("en");
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(MemoryGlyph, { size: 15, className: "um-dsh-tab-title-icon" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: translate("rightTab.title") })
  ] });
}
function SessionContextTab(props) {
  const { sessionId, useSessions, useTabInfo, t: slotT, openGlobalConsole } = props;
  const t = (0, import_react.useMemo)(() => slotT ?? createFallbackTranslator("en"), [slotT]);
  const tabInfo = useTabInfo ? useTabInfo() : void 0;
  const tabVisible = tabInfo?.tab.visible ?? true;
  const liveSessionCwd = useSessions ? useSessions((state) => sessionId ? state.byId[sessionId]?.cwd ?? "" : "") : "";
  const [snapshot, setSnapshot] = (0, import_react.useState)(null);
  const [loading, setLoading] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  const refresh = (0, import_react.useCallback)(async () => {
    if (!sessionId) {
      setSnapshot(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await unifiedMemoryApi.getSessionContext(sessionId);
      setSnapshot(res.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    } finally {
      setLoading(false);
    }
  }, [sessionId, t]);
  (0, import_react.useEffect)(() => {
    if (!tabInfo) return;
    return tabInfo.tab.actions.bindCommands({
      refresh: () => {
        void refresh();
      }
    });
  }, [tabInfo, refresh]);
  (0, import_react.useEffect)(() => {
    if (tabVisible) {
      void refresh();
    }
  }, [sessionId, liveSessionCwd, tabVisible, refresh]);
  if (!sessionId) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-dsh-right-tab", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-empty", children: t("rightTab.noSession") }) });
  }
  const displayCwd = snapshot?.cwd || liveSessionCwd || snapshot?.resolvedProjectRoot || "";
  const memIdx = snapshot?.claudeMemoryIndex ?? null;
  const linePct = memIdx ? Math.min(100, memIdx.totalLines / memIdx.maxLines * 100) : 0;
  const bytePct = memIdx ? Math.min(100, memIdx.totalBytes / memIdx.maxBytes * 100) : 0;
  const lineTone = linePct >= 95 ? "danger" : linePct >= 80 ? "warn" : "";
  const byteTone = bytePct >= 95 ? "danger" : bytePct >= 80 ? "warn" : "";
  const originLabel = snapshot?.origin === "subagent" ? snapshot.isSeeded ? t("rightTab.originFork") : t("rightTab.originSubagent") : t("rightTab.originRoot");
  const triggeredConditional = (snapshot?.indexedConditionalRules ?? []).filter((r) => r.loaded);
  const pendingConditional = (snapshot?.indexedConditionalRules ?? []).filter((r) => !r.loaded);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-dsh-right-tab", "data-unified-memory-session-tab": true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-dsh-right-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-dsh-right-title", title: displayCwd || sessionId, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(MemoryGlyph, { size: 14 }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("rightTab.title") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-row", style: { gap: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            className: "um-btn sm",
            onClick: () => void refresh(),
            disabled: loading,
            title: t("common.refresh"),
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RefreshIcon, { size: 11 })
          }
        ),
        openGlobalConsole && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "um-btn sm", onClick: openGlobalConsole, children: t("rightTab.openConsole") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-dsh-right-body", children: [
      error && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-banner danger", style: { marginBottom: 0 }, children: error }),
      !snapshot ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-dsh-right-card", children: [
        liveSessionCwd && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-mono um-muted", style: { marginBottom: 8 }, children: liveSessionCwd }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-muted", children: loading ? t("common.loading") : t("rightTab.notYetInjected") })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        snapshot.pendingExternalApprovalCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-banner warn", style: { marginBottom: 0 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("rightTab.pendingExternal", {
            count: snapshot.pendingExternalApprovalCount
          }) }),
          openGlobalConsole && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "um-btn sm", onClick: openGlobalConsole, children: t("rightTab.openConsole") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-dsh-right-card", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-row-between", style: { marginBottom: 8 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "um-badge info", children: snapshot.resolvedLocale }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "um-caption", children: t("rightTab.updatedAt", { ts: fmtShortTime(snapshot.updatedAt) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-dsh-right-kv", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "um-kv-key", children: t("rightTab.baseline") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "um-row", style: { gap: 4 }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: `um-badge ${snapshot.baselineInjected ? "success" : "warn"}`, children: snapshot.baselineInjected ? t("rightTab.baselineInjected", { bytes: fmtBytes(snapshot.baselineBytes) }) : t("rightTab.baselinePending") }) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "um-kv-key", children: t("rightTab.compactions") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "um-row", style: { gap: 4 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: `um-badge ${snapshot.compactionCount > 0 ? "warn" : ""}`, children: snapshot.compactionCount }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "um-caption", children: t("rightTab.replaceGen", { gen: snapshot.replaceGeneration }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "um-kv-key", children: t("rightTab.hostDedup") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "span",
              {
                className: `um-badge ${snapshot.hostAgentInstructionsActive ? "info" : ""}`,
                children: snapshot.hostAgentInstructionsActive ? t("rightTab.hostDedupActive", { count: snapshot.hostLoadedPaths.length }) : t("rightTab.hostDedupInactive")
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "um-kv-key", children: t("rightTab.codexInjected") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: `um-badge ${snapshot.codexSummaryInjected ? "success" : ""}`, children: snapshot.codexSummaryInjected ? t("common.yes") : t("common.no") }) }),
            displayCwd && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "um-kv-key", children: t("rightTab.cwd") }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "um-mono", children: displayCwd })
            ] }),
            snapshot.claudeSlug && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "um-kv-key", children: t("rightTab.slug") }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "um-mono", children: snapshot.claudeSlug })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-caption", style: { marginTop: 6 }, children: originLabel })
        ] }),
        memIdx && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-dsh-right-card", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-dsh-right-section-title", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("rightTab.memoryIndex") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: `um-badge ${memIdx.truncated ? "danger" : "success"}`, children: memIdx.topicCount })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-row-between um-caption", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("claude.linesLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "um-mono", children: [
              memIdx.totalLines,
              "/",
              memIdx.maxLines
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-progress-track", style: { marginBottom: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "div",
            {
              className: `um-progress-fill ${lineTone}`,
              style: { width: `${linePct}%` }
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-row-between um-caption", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("claude.sizeLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "um-mono", children: [
              (memIdx.totalBytes / 1024).toFixed(1),
              "/",
              (memIdx.maxBytes / 1024).toFixed(0),
              " KB"
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-progress-track", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "div",
            {
              className: `um-progress-fill ${byteTone}`,
              style: { width: `${bytePct}%` }
            }
          ) })
        ] }),
        snapshot.hostLoadedPaths.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-dsh-right-card", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h4", { className: "um-dsh-right-section-title", children: t("rightTab.sectionHostDeduped", { count: snapshot.hostLoadedPaths.length }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-dsh-chip-list", children: snapshot.hostLoadedPaths.map((p) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-dsh-chip-row um-mono", children: p }, p)) })
        ] }),
        snapshot.loadedAlwaysOnRules.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-dsh-right-card", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h4", { className: "um-dsh-right-section-title", children: t("rightTab.sectionAlwaysOn", { count: snapshot.loadedAlwaysOnRules.length }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-dsh-chip-list", children: snapshot.loadedAlwaysOnRules.map((rule) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-dsh-chip-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-row", style: { gap: 4, marginBottom: 2 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "um-badge info", children: rule.scope }),
              rule.dedupedByHost && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "um-badge warn", children: t("rules.badgeHostDeduped") }),
              rule.importsCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "um-badge", children: [
                "@",
                rule.importsCount
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-mono", children: rule.displayPath })
          ] }, rule.filePath)) })
        ] }),
        snapshot.loadedSubdirClaudeMds.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-dsh-right-card", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h4", { className: "um-dsh-right-section-title", children: t("rightTab.sectionLazySubdirs", {
            count: snapshot.loadedSubdirClaudeMds.length
          }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-dsh-chip-list", children: snapshot.loadedSubdirClaudeMds.map((sub) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-dsh-chip-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-mono", children: sub.displayPath }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-caption um-mono", children: [
              "\u2190 ",
              sub.triggeredBy
            ] })
          ] }, sub.filePath)) })
        ] }),
        snapshot.indexedConditionalRules.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-dsh-right-card", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h4", { className: "um-dsh-right-section-title", children: t("rightTab.sectionConditional", {
            count: snapshot.indexedConditionalRules.length
          }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-dsh-chip-list", children: [...triggeredConditional, ...pendingConditional].map((rule) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-dsh-chip-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-row", style: { gap: 4, marginBottom: 2 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: `um-badge ${rule.loaded ? "success" : ""}`, children: rule.loaded ? t("rightTab.ruleLoaded") : t("rightTab.ruleStandby") }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "um-badge info", children: rule.scope })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-mono", children: rule.displayPath }),
            rule.paths.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-caption um-mono", children: rule.paths.join(", ") }),
            rule.triggeredBy && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-caption um-mono", children: [
              "\u2190 ",
              rule.triggeredBy
            ] })
          ] }, rule.id)) })
        ] }),
        snapshot.injectedLabels.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "um-dsh-right-card", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h4", { className: "um-dsh-right-section-title", children: t("rightTab.sectionInjected", { count: snapshot.injectedLabels.length }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "um-row", style: { gap: 4 }, children: snapshot.injectedLabels.map((lbl, idx) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "um-badge", children: lbl }, `${lbl}-${idx}`)) })
        ] })
      ] })
    ] })
  ] });
}

// src/client/components/UnifiedMemoryConsole.tsx
var import_react6 = require("react");

// src/client/components/ClaudeTab.tsx
var import_react2 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var MEMORY_TYPES = ["user", "feedback", "project", "reference"];
var TYPE_BADGE = {
  user: "info",
  feedback: "warn",
  project: "success",
  reference: ""
};
function measureUtf8Bytes(text) {
  return new TextEncoder().encode(text).length;
}
function ClaudeTab({
  projects,
  selectedSlug,
  onSelectSlug,
  t,
  onOverviewRefresh,
  onNotify
}) {
  const [data, setData] = (0, import_react2.useState)(null);
  const [loading, setLoading] = (0, import_react2.useState)(false);
  const [typeFilter, setTypeFilter] = (0, import_react2.useState)("all");
  const [search, setSearch] = (0, import_react2.useState)("");
  const [expandedFile, setExpandedFile] = (0, import_react2.useState)(null);
  const [confirmDeleteFile, setConfirmDeleteFile] = (0, import_react2.useState)(null);
  const [draft, setDraft] = (0, import_react2.useState)(null);
  const [saving, setSaving] = (0, import_react2.useState)(false);
  const [editingIndex, setEditingIndex] = (0, import_react2.useState)(false);
  const [indexDraft, setIndexDraft] = (0, import_react2.useState)("");
  const loadProject = (0, import_react2.useCallback)(
    async (slug) => {
      if (!slug) return;
      setLoading(true);
      try {
        const res = await unifiedMemoryApi.listClaudeMemories({ slug });
        setData(res);
        setIndexDraft(res.index.content);
        setConfirmDeleteFile(null);
      } catch (err) {
        onNotify(err instanceof Error ? err.message : t("common.unknownError"), "danger");
      } finally {
        setLoading(false);
      }
    },
    [onNotify, t]
  );
  (0, import_react2.useEffect)(() => {
    if (selectedSlug) {
      void loadProject(selectedSlug);
    } else if (projects.length > 0) {
      onSelectSlug(projects[0].slug);
    }
  }, [selectedSlug, projects.length, loadProject, onSelectSlug]);
  const filteredTopics = (0, import_react2.useMemo)(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.topics.filter((topic) => {
      if (typeFilter !== "all" && topic.type !== typeFilter) return false;
      if (!q) return true;
      return topic.name.toLowerCase().includes(q) || topic.description.toLowerCase().includes(q) || topic.filename.toLowerCase().includes(q) || topic.body.toLowerCase().includes(q);
    });
  }, [data, typeFilter, search]);
  const handleSaveTopic = async (e) => {
    e.preventDefault();
    if (!draft || !selectedSlug) return;
    setSaving(true);
    try {
      const res = await unifiedMemoryApi.saveClaudeTopic({
        slug: selectedSlug,
        filename: draft.isNew ? draft.filename.trim() || void 0 : draft.filename,
        name: draft.name.trim(),
        description: draft.description.trim(),
        type: draft.type,
        body: draft.body
      });
      setDraft(null);
      await loadProject(selectedSlug);
      await onOverviewRefresh();
      if (res.warnings.length > 0) {
        onNotify(t("claude.topicSavedWarn", { warning: res.warnings[0] }), "warn");
      } else {
        onNotify(t("claude.topicSaved"), "success");
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t("common.unknownError"), "danger");
    } finally {
      setSaving(false);
    }
  };
  const handleDeleteTopic = async (topic) => {
    if (!selectedSlug) return;
    setSaving(true);
    try {
      await unifiedMemoryApi.deleteClaudeTopic({
        slug: selectedSlug,
        filename: topic.filename
      });
      if (expandedFile === topic.filename) setExpandedFile(null);
      setConfirmDeleteFile(null);
      await loadProject(selectedSlug);
      await onOverviewRefresh();
      onNotify(t("claude.topicDeleted", { filename: topic.filename }), "info");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t("common.unknownError"), "danger");
    } finally {
      setSaving(false);
    }
  };
  const handleSaveIndex = async () => {
    if (!selectedSlug) return;
    setSaving(true);
    try {
      await unifiedMemoryApi.saveClaudeIndex({
        slug: selectedSlug,
        content: indexDraft
      });
      setEditingIndex(false);
      await loadProject(selectedSlug);
      await onOverviewRefresh();
      onNotify(t("claude.indexSaved"), "success");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t("common.unknownError"), "danger");
    } finally {
      setSaving(false);
    }
  };
  const effectiveLines = editingIndex ? indexDraft === "" ? 0 : indexDraft.split(/\r?\n/).length : data?.index.totalLines ?? 0;
  const effectiveBytes = editingIndex ? measureUtf8Bytes(indexDraft) : data?.index.totalBytes ?? 0;
  const maxLines = data?.index.maxLines ?? 200;
  const maxBytes = data?.index.maxBytes ?? 25 * 1024;
  const linePct = Math.min(100, effectiveLines / maxLines * 100);
  const bytePct = Math.min(100, effectiveBytes / maxBytes * 100);
  const lineTone = linePct >= 95 ? "danger" : linePct >= 80 ? "warn" : "";
  const byteTone = bytePct >= 95 ? "danger" : bytePct >= 80 ? "warn" : "";
  const isOverCap = (editingIndex ? effectiveLines > maxLines || effectiveBytes > maxBytes : data?.index.truncated) ?? false;
  const hasSelectedInProjects = selectedSlug !== "" && projects.some((p) => p.slug === selectedSlug);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-card um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "select",
          {
            className: "um-select",
            style: { flex: 1, minWidth: 200 },
            value: selectedSlug,
            onChange: (e) => onSelectSlug(e.target.value),
            children: [
              projects.length === 0 && !selectedSlug && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: "", children: t("claude.noProjects") }),
              selectedSlug && !hasSelectedInProjects && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: selectedSlug, children: t("claude.projectOptionNew", {
                path: data?.slug === selectedSlug && data.resolvedRoot ? data.resolvedRoot : selectedSlug
              }) }),
              projects.map((p) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: p.slug, children: t("claude.projectOption", { path: p.displayPath, count: p.topicCount }) }, p.slug))
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            type: "button",
            className: "um-btn",
            onClick: () => selectedSlug && void loadProject(selectedSlug),
            disabled: loading || !selectedSlug,
            children: t("common.refresh")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            type: "button",
            className: "um-btn primary",
            disabled: !selectedSlug,
            onClick: () => setDraft({
              isNew: true,
              filename: "",
              name: "",
              description: "",
              type: "project",
              body: ""
            }),
            children: t("claude.newTopic")
          }
        )
      ] }),
      data && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "um-muted um-mono", style: { marginTop: 6 }, children: data.memoryDir })
    ] }),
    data && !data.autoMemoryEnabled && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "um-banner warn", children: t("claude.autoMemoryDisabled") }),
    data && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-card um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-card-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { className: "um-card-title", children: t("claude.indexTitle") }),
          isOverCap ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "um-badge danger", children: t("claude.indexTruncated", {
            lines: maxLines,
            kb: (maxBytes / 1024).toFixed(0)
          }) }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "um-badge success", children: t("claude.indexWithinCap") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            type: "button",
            className: "um-btn sm",
            onClick: () => {
              if (!editingIndex) setIndexDraft(data.index.content);
              setEditingIndex((v) => !v);
            },
            children: editingIndex ? t("claude.closeEditor") : t("claude.editIndex")
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-grid-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-row-between um-muted", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: t("claude.linesLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "um-mono", children: [
              effectiveLines,
              " / ",
              maxLines
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "um-progress-track", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: `um-progress-fill ${lineTone}`, style: { width: `${linePct}%` } }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-row-between um-muted", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: t("claude.sizeLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "um-mono", children: [
              (effectiveBytes / 1024).toFixed(1),
              " / ",
              (maxBytes / 1024).toFixed(1),
              " KB"
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "um-progress-track", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: `um-progress-fill ${byteTone}`, style: { width: `${bytePct}%` } }) })
        ] })
      ] }),
      editingIndex ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { marginTop: 10 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "textarea",
          {
            className: "um-textarea",
            style: { minHeight: 200 },
            value: indexDraft,
            onChange: (e) => setIndexDraft(e.target.value)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-row", style: { marginTop: 8, justifyContent: "flex-end" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              className: "um-btn",
              onClick: () => setEditingIndex(false),
              disabled: saving,
              children: t("common.cancel")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              className: "um-btn primary",
              onClick: () => void handleSaveIndex(),
              disabled: saving,
              children: saving ? t("common.saving") : t("claude.saveIndex")
            }
          )
        ] })
      ] }) : data.index.exists && data.index.content.trim() ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("pre", { className: "um-pre", style: { maxHeight: 190 }, children: data.index.content }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "um-empty", style: { padding: "12px 0 4px" }, children: t("claude.noIndexYet") })
    ] }),
    data && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-card um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-card-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { className: "um-card-title", children: t("claude.topicsTitle", { count: filteredTopics.length }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "um-pill-bar", children: ["all", ...MEMORY_TYPES].map((tp) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            type: "button",
            className: `um-pill ${typeFilter === tp ? "active" : ""}`,
            onClick: () => setTypeFilter(tp),
            children: tp === "all" ? t("claude.filterAll") : t(`claude.type.${tp}`)
          },
          tp
        )) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "input",
        {
          className: "um-input",
          style: { marginBottom: 10 },
          placeholder: t("claude.searchPlaceholder"),
          value: search,
          onChange: (e) => setSearch(e.target.value)
        }
      ),
      loading ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "um-empty", children: t("claude.loadingProject") }) : filteredTopics.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "um-empty", children: t("claude.noMatchingTopics") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "um-list", children: filteredTopics.map((topic) => {
        const isExpanded = expandedFile === topic.filename;
        const isConfirmingDelete = confirmDeleteFile === topic.filename;
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-item", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-row-between", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: topic.name }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: `um-badge ${TYPE_BADGE[topic.type] ?? ""}`, children: topic.type }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "um-badge", children: topic.schema === "nested_metadata" ? t("claude.schemaNested") : topic.schema === "flat" ? t("claude.schemaFlat") : t("claude.schemaNone") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "button",
                {
                  type: "button",
                  className: "um-btn sm",
                  onClick: () => setExpandedFile(isExpanded ? null : topic.filename),
                  children: isExpanded ? t("common.hide") : t("common.read")
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "button",
                {
                  type: "button",
                  className: "um-btn sm",
                  onClick: () => setDraft({
                    isNew: false,
                    filename: topic.filename,
                    name: topic.name,
                    description: topic.description,
                    type: MEMORY_TYPES.includes(topic.type) ? topic.type : "project",
                    body: topic.body
                  }),
                  children: t("common.edit")
                }
              ),
              isConfirmingDelete ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "um-btn sm danger",
                    disabled: saving,
                    onClick: () => void handleDeleteTopic(topic),
                    children: t("common.confirmDelete")
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "um-btn sm",
                    disabled: saving,
                    onClick: () => setConfirmDeleteFile(null),
                    children: t("common.cancel")
                  }
                )
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "button",
                {
                  type: "button",
                  className: "um-btn sm danger",
                  onClick: () => setConfirmDeleteFile(topic.filename),
                  children: t("common.delete")
                }
              )
            ] })
          ] }),
          topic.description && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { marginTop: 4, color: "var(--um-text-2)" }, children: topic.description }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-row um-muted", style: { marginTop: 6 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "um-mono", children: topic.filename }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\xB7" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
              topic.sizeBytes,
              " B"
            ] }),
            topic.modified && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\xB7" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: t("claude.modifiedAt", {
                ts: `${topic.modified.slice(0, 19).replace("T", " ")}Z`
              }) })
            ] })
          ] }),
          isExpanded && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("pre", { className: "um-pre", children: topic.body || topic.rawContent })
        ] }, topic.filename);
      }) })
    ] }),
    draft && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        className: "um-dsh-modal-backdrop",
        role: "dialog",
        "aria-modal": "true",
        onClick: () => !saving && setDraft(null),
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-dsh-modal", onClick: (e) => e.stopPropagation(), children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-card-header", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { className: "um-card-title", children: draft.isNew ? t("claude.modalNewTitle") : t("claude.modalEditTitle", { filename: draft.filename }) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "um-badge info", children: t("claude.modalSchemaBadge") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("form", { onSubmit: (e) => void handleSaveTopic(e), children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "um-label", children: t("claude.fieldType") }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "select",
                {
                  className: "um-select",
                  value: draft.type,
                  onChange: (e) => setDraft({ ...draft, type: e.target.value }),
                  children: MEMORY_TYPES.map((tp) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("option", { value: tp, children: [
                    tp,
                    " \u2014 ",
                    t(`claude.typeDesc.${tp}`)
                  ] }, tp))
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "um-label", children: t("claude.fieldName") }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "input",
                {
                  className: "um-input",
                  required: true,
                  value: draft.name,
                  onChange: (e) => setDraft({ ...draft, name: e.target.value }),
                  placeholder: t("claude.fieldNamePlaceholder")
                }
              )
            ] }),
            draft.isNew && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "um-label", children: t("claude.fieldFilename") }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "input",
                {
                  className: "um-input um-mono",
                  value: draft.filename,
                  onChange: (e) => setDraft({ ...draft, filename: e.target.value }),
                  placeholder: t("claude.fieldFilenamePlaceholder")
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "um-label", children: t("claude.fieldDescription") }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "input",
                {
                  className: "um-input",
                  required: true,
                  value: draft.description,
                  onChange: (e) => setDraft({ ...draft, description: e.target.value }),
                  placeholder: t("claude.fieldDescriptionPlaceholder")
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "um-label", children: t("claude.fieldBody") }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "textarea",
                {
                  className: "um-textarea",
                  required: true,
                  value: draft.body,
                  onChange: (e) => setDraft({ ...draft, body: e.target.value }),
                  placeholder: t("claude.fieldBodyPlaceholder")
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "um-row", style: { justifyContent: "flex-end", marginTop: 12 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "button",
                {
                  type: "button",
                  className: "um-btn",
                  onClick: () => setDraft(null),
                  disabled: saving,
                  children: t("common.cancel")
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "submit", className: "um-btn primary", disabled: saving, children: saving ? t("common.saving") : t("claude.saveAndSync") })
            ] })
          ] })
        ] })
      }
    )
  ] });
}

// src/client/components/CodexTab.tsx
var import_react3 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
var FILE_CATEGORIES = ["all", "summary", "handbook", "extension", "rollout", "skill"];
function fmtBytes2(b) {
  return b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`;
}
function CodexTab({ defaultProjectHint, t, onNotify }) {
  const [generation, setGeneration] = (0, import_react3.useState)("auto");
  const [subView, setSubView] = (0, import_react3.useState)("summary");
  const [categoryFilter, setCategoryFilter] = (0, import_react3.useState)("all");
  const [query, setQuery] = (0, import_react3.useState)("");
  const [projectHint, setProjectHint] = (0, import_react3.useState)(defaultProjectHint ?? "");
  const [browseData, setBrowseData] = (0, import_react3.useState)(null);
  const [hits, setHits] = (0, import_react3.useState)([]);
  const [openedFile, setOpenedFile] = (0, import_react3.useState)(null);
  const [loading, setLoading] = (0, import_react3.useState)(false);
  const [searching, setSearching] = (0, import_react3.useState)(false);
  const loadBrowse = (0, import_react3.useCallback)(
    async (gen) => {
      setLoading(true);
      try {
        const res = await unifiedMemoryApi.browseCodex(gen);
        setBrowseData(res);
      } catch (err) {
        onNotify(err instanceof Error ? err.message : t("common.unknownError"), "danger");
      } finally {
        setLoading(false);
      }
    },
    [onNotify, t]
  );
  (0, import_react3.useEffect)(() => {
    void loadBrowse(generation);
  }, [generation, loadBrowse]);
  const handleSearch = async (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setSubView("search");
    setSearching(true);
    try {
      const res = await unifiedMemoryApi.searchCodex({
        query: trimmed,
        projectHint: projectHint.trim() || void 0,
        generation: generation === "auto" ? "both" : generation
      });
      setHits(res.hits);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t("common.unknownError"), "danger");
    } finally {
      setSearching(false);
    }
  };
  const openFile = async (gen, relativePath) => {
    setLoading(true);
    try {
      const res = await unifiedMemoryApi.readCodexFile({
        generation: gen,
        relativePath
      });
      setOpenedFile(res);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t("common.unknownError"), "danger");
    } finally {
      setLoading(false);
    }
  };
  const filteredFiles = (0, import_react3.useMemo)(() => {
    if (!browseData) return [];
    if (categoryFilter === "all") return browseData.files;
    return browseData.files.filter((f) => f.category === categoryFilter);
  }, [browseData, categoryFilter]);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "um-banner info", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: t("codex.roBannerTitle") }),
      " ",
      t("codex.roBannerBody")
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "um-card um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "um-row-between", style: { marginBottom: 10 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "um-pill-bar", children: ["auto", "v2", "v1"].map((g) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            className: `um-pill ${generation === g ? "active" : ""}`,
            onClick: () => setGeneration(g),
            children: g === "auto" ? t("codex.genAuto", { gen: browseData?.status.activeGeneration ?? "..." }) : g === "v2" ? `${t("codex.genV2")}${browseData?.status.v2.exists ? "" : t("codex.absent")}` : `${t("codex.genV1")}${browseData?.status.v1.exists ? "" : t("codex.absent")}`
          },
          g
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "um-pill-bar", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "button",
            {
              type: "button",
              className: `um-pill ${subView === "summary" ? "active" : ""}`,
              onClick: () => setSubView("summary"),
              children: t("codex.viewSummary")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "button",
            {
              type: "button",
              className: `um-pill ${subView === "files" ? "active" : ""}`,
              onClick: () => setSubView("files"),
              children: t("codex.viewFiles", { count: browseData?.files.length ?? 0 })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "button",
            {
              type: "button",
              className: `um-pill ${subView === "search" ? "active" : ""}`,
              onClick: () => setSubView("search"),
              children: t("codex.viewSearch", { count: hits.length })
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("form", { className: "um-row", onSubmit: (e) => void handleSearch(e), children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "input",
          {
            className: "um-input",
            style: { flex: 2, minWidth: 160 },
            value: query,
            onChange: (e) => setQuery(e.target.value),
            placeholder: t("codex.searchPlaceholder")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "input",
          {
            className: "um-input",
            style: { flex: 1, minWidth: 120 },
            value: projectHint,
            onChange: (e) => setProjectHint(e.target.value),
            placeholder: t("codex.projectBoostPlaceholder")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "submit",
            className: "um-btn primary",
            disabled: searching || !query.trim(),
            children: searching ? t("codex.searching") : t("codex.searchBtn")
          }
        )
      ] })
    ] }),
    openedFile && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "um-card um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "um-card-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "um-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "um-badge info", children: openedFile.generation }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "um-mono", children: openedFile.relativePath }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "um-muted", children: fmtBytes2(openedFile.sizeBytes) }),
          openedFile.truncated && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "um-badge warn", children: t("codex.truncated") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            className: "um-btn sm",
            onClick: () => setOpenedFile(null),
            children: t("codex.closeViewer")
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("pre", { className: "um-pre", children: openedFile.content })
    ] }),
    subView === "summary" && browseData && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "um-card um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "um-card-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "um-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { className: "um-card-title", children: "memory_summary.md" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "um-badge success", children: browseData.summary.generation }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "um-muted", children: fmtBytes2(browseData.summary.totalBytes) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            className: "um-btn sm",
            onClick: () => void loadBrowse(generation),
            disabled: loading,
            children: t("common.refresh")
          }
        )
      ] }),
      browseData.summary.content ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("pre", { className: "um-pre", style: { maxHeight: 480 }, children: browseData.summary.content }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "um-empty", children: t("codex.noSummary") })
    ] }),
    subView === "files" && browseData && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "um-card um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "um-card-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { className: "um-card-title", children: t("codex.filesTitle", {
          dir: browseData.selectedGeneration === "v2" ? "memories_v2" : "memories",
          count: filteredFiles.length
        }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "um-pill-bar", children: FILE_CATEGORIES.map((cat) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            className: `um-pill ${categoryFilter === cat ? "active" : ""}`,
            onClick: () => setCategoryFilter(cat),
            children: cat === "all" ? t("claude.filterAll") : t(`codex.cat.${cat}`)
          },
          cat
        )) })
      ] }),
      filteredFiles.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "um-empty", children: t("codex.noFiles") }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "um-list", children: filteredFiles.map((f) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "div",
        {
          className: "um-item um-item-hover",
          onClick: () => void openFile(browseData.selectedGeneration, f.relativePath),
          children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "um-row-between", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "um-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "um-badge info", children: t(`codex.cat.${f.category}`) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "um-mono", children: f.relativePath })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "um-muted", children: fmtBytes2(f.sizeBytes) })
          ] })
        },
        f.relativePath
      )) })
    ] }),
    subView === "search" && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "um-card um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "um-card-header", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { className: "um-card-title", children: t("codex.searchResultsTitle", { count: hits.length }) }) }),
      hits.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "um-empty", children: t("codex.searchEmpty") }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "um-list", children: hits.map((hit, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "div",
        {
          className: "um-item um-item-hover",
          onClick: () => void openFile(hit.generation, hit.relativePath),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "um-row-between", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "um-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "um-badge success", children: hit.generation }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "um-badge info", children: t(`codex.cat.${hit.category}`) }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: hit.title })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "um-muted", children: t("codex.score", { score: hit.score }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "um-muted", style: { marginTop: 4 }, children: hit.snippet }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "um-mono um-muted", style: { marginTop: 4 }, children: hit.relativePath })
          ]
        },
        `${hit.generation}-${hit.relativePath}-${i}`
      )) })
    ] })
  ] });
}

// src/client/components/OverviewTab.tsx
var import_react4 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
function fmtBytes3(bytes) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}
function fmtTime(isoOrMs) {
  if (!isoOrMs) return "\u2014";
  const d = new Date(isoOrMs);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleString(void 0, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
function OverviewTab({
  overview,
  t,
  onRefresh,
  onSelectClaudeProject,
  onSelectRulesWorkspace,
  onNotify
}) {
  const [probePath, setProbePath] = (0, import_react4.useState)(overview.workspaceHints[0] ?? "");
  const [resolution, setResolution] = (0, import_react4.useState)(null);
  const [resolving, setResolving] = (0, import_react4.useState)(false);
  const [savingCfg, setSavingCfg] = (0, import_react4.useState)(false);
  const handleResolve = async () => {
    const trimmed = probePath.trim();
    if (!trimmed) return;
    setResolving(true);
    try {
      const res = await unifiedMemoryApi.resolveClaudeProject(trimmed);
      setResolution(res);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t("common.unknownError"), "danger");
    } finally {
      setResolving(false);
    }
  };
  const updateCfg = async (patch) => {
    setSavingCfg(true);
    try {
      await unifiedMemoryApi.updateConfig(patch);
      await onRefresh();
      onNotify(t("overview.settingsSaved"), "success");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t("common.unknownError"), "danger");
    } finally {
      setSavingCfg(false);
    }
  };
  const handleClearDiagnostics = async () => {
    try {
      await unifiedMemoryApi.clearDiagnostics();
      await onRefresh();
      onNotify(t("overview.logCleared"), "info");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t("common.unknownError"), "danger");
    }
  };
  const activeCodexGen = overview.codex.activeGeneration === "v2" ? overview.codex.v2 : overview.codex.activeGeneration === "v1" ? overview.codex.v1 : null;
  const activeIds = new Set(overview.activeSessions.map((s) => s.sessionId));
  const nonActiveRecent = overview.recentSessions.filter((s) => !activeIds.has(s.conversationId));
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-grid-2 um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-card-header", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { className: "um-card-title", children: t("overview.claudeTitle") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: `um-badge ${overview.claude.exists ? "success" : "warn"}`, children: overview.claude.exists ? t("overview.claudeReady") : t("overview.claudeMissing") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-kv-key", children: t("overview.configDir") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-mono", children: overview.claude.configDir }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-kv-key", children: t("overview.projects") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: t("overview.projectsSummary", {
            projects: overview.claude.projectCount,
            topics: overview.claude.totalTopics
          }) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-kv-key", children: t("overview.globalFiles") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "um-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: `um-badge ${overview.claude.hasGlobalClaudeMd ? "info" : ""}`, children: [
              "CLAUDE.md: ",
              overview.claude.hasGlobalClaudeMd ? t("common.yes") : t("common.no")
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: `um-badge ${overview.claude.hasGlobalRulesDir ? "info" : ""}`, children: [
              "rules/: ",
              overview.claude.hasGlobalRulesDir ? t("common.yes") : t("common.no")
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-kv-key", children: t("overview.writeSchema") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-mono", children: t("overview.writeSchemaVal") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-card-header", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { className: "um-card-title", children: t("overview.codexTitle") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: `um-badge ${activeCodexGen ? "info" : "warn"}`, children: activeCodexGen ? t("overview.codexReadOnly", { gen: overview.codex.activeGeneration }) : t("overview.codexMissing") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-kv-key", children: t("overview.codexHome") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-mono", children: overview.codex.codexHome }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-kv-key", children: t("overview.activeStore") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: activeCodexGen ? t("overview.codexActiveSummary", {
            gen: activeCodexGen.generation,
            bytes: fmtBytes3(activeCodexGen.summaryBytes),
            lines: activeCodexGen.summaryLines,
            rollouts: activeCodexGen.rolloutCount
          }) : t("overview.codexNoDir") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-kv-key", children: t("overview.generations") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "um-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: `um-badge ${overview.codex.v2.exists ? "success" : ""}`, children: [
              "memories_v2: ",
              overview.codex.v2.exists ? t("common.yes") : t("common.no")
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: `um-badge ${overview.codex.v1.exists ? "info" : ""}`, children: [
              "memories (v1): ",
              overview.codex.v1.exists ? t("common.yes") : t("common.no")
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-kv-key", children: t("overview.configFlags") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "um-mono", children: [
            "memories=",
            String(overview.codex.configFlags.featuresMemories ?? t("common.unset")),
            " \xB7 use=",
            String(overview.codex.configFlags.useMemories ?? t("common.unset"))
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-card um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-card-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { className: "um-card-title", children: t("overview.resolverTitle") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-muted", children: t("overview.resolverSubtitle") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "input",
          {
            className: "um-input",
            style: { flex: 1, minWidth: 200 },
            value: probePath,
            onChange: (e) => setProbePath(e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") void handleResolve();
            },
            placeholder: t("overview.resolverPlaceholder"),
            list: "um-dsh-workspace-hints"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("datalist", { id: "um-dsh-workspace-hints", children: overview.workspaceHints.map((h) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: h }, h)) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "button",
          {
            type: "button",
            className: "um-btn primary",
            onClick: () => void handleResolve(),
            disabled: resolving || !probePath.trim(),
            children: resolving ? t("overview.resolving") : t("overview.resolve")
          }
        )
      ] }),
      resolution && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-item", style: { marginTop: 10 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-kv-key", children: t("overview.mainRepoRoot") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "um-mono", children: [
            resolution.resolvedRoot,
            " ",
            resolution.isGitWorktree && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-badge info", children: t("overview.worktreeBadge") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-kv-key", children: t("overview.encodedSlug") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-mono", children: resolution.slug }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-kv-key", children: t("overview.memoryDir") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "um-mono", children: [
            resolution.memoryDir,
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: `um-badge ${resolution.exists ? "success" : "warn"}`, children: resolution.exists ? t("overview.dirExists") : t("overview.dirWillCreate") })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-row", style: { marginTop: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "button",
            {
              type: "button",
              className: "um-btn sm",
              onClick: () => onSelectClaudeProject(resolution.slug),
              children: t("overview.openInClaudeTab")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "button",
            {
              type: "button",
              className: "um-btn sm",
              onClick: () => onSelectRulesWorkspace(resolution.resolvedRoot),
              children: t("overview.inspectRulesForWorkspace")
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-card um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-card-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { className: "um-card-title", children: t("overview.settingsTitle") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-muted um-mono", children: t("overview.settingsSubtitle", { dir: overview.pluginDataDir }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-toggle", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { children: t("overview.localeLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "um-muted", children: t("overview.localeDesc", {
            resolved: overview.resolvedLocale,
            hostPref: overview.hostLocalePreference ?? t("common.unset")
          }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "select",
          {
            className: "um-select",
            style: { width: 210, flexShrink: 0 },
            value: overview.config.locale,
            disabled: savingCfg,
            onChange: (e) => void updateCfg({ locale: e.target.value }),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "auto", children: t("overview.localeAuto") }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "zh", children: t("overview.localeZh") }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "en", children: t("overview.localeEn") })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-toggle", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { children: t("overview.codexStartLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "um-muted", children: t("overview.codexStartDesc") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "input",
          {
            type: "checkbox",
            className: "um-checkbox",
            checked: overview.config.injectCodexSummaryOnStart,
            disabled: savingCfg,
            onChange: (e) => void updateCfg({ injectCodexSummaryOnStart: e.target.checked })
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-toggle", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { children: t("overview.codexBudgetLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "um-muted", children: t("overview.codexBudgetDesc") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "select",
          {
            className: "um-select",
            style: { width: 120, flexShrink: 0 },
            value: overview.config.codexSummaryMaxBytes,
            disabled: savingCfg,
            onChange: (e) => void updateCfg({ codexSummaryMaxBytes: Number(e.target.value) }),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: 4096, children: "4 KB" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: 8192, children: "8 KB" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: 16384, children: "16 KB" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: 32768, children: "32 KB" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-toggle", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { children: t("overview.maxStartupBudgetLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "um-muted", children: t("overview.maxStartupBudgetDesc") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "select",
          {
            className: "um-select",
            style: { width: 120, flexShrink: 0 },
            value: overview.config.maxStartupInjectBytes,
            disabled: savingCfg,
            onChange: (e) => void updateCfg({ maxStartupInjectBytes: Number(e.target.value) }),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: 32768, children: "32 KB" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: 65536, children: "64 KB" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: 131072, children: "128 KB" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: 262144, children: "256 KB" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-toggle", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { children: t("overview.dedupLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "um-muted", children: t("overview.dedupDesc") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "input",
          {
            type: "checkbox",
            className: "um-checkbox",
            checked: overview.config.deduplicateNativeAgentsMd,
            disabled: savingCfg,
            onChange: (e) => void updateCfg({ deduplicateNativeAgentsMd: e.target.checked })
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-toggle", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { children: t("overview.reuseApprovalsLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "um-muted", children: t("overview.reuseApprovalsDesc") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "input",
          {
            type: "checkbox",
            className: "um-checkbox",
            checked: overview.config.trustClaudeCodeExternalApprovals,
            disabled: savingCfg,
            onChange: (e) => void updateCfg({ trustClaudeCodeExternalApprovals: e.target.checked })
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-toggle", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { children: t("overview.codexGlobalAgentsLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "um-muted", children: t("overview.codexGlobalAgentsDesc") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "input",
          {
            type: "checkbox",
            className: "um-checkbox",
            checked: overview.config.injectCodexGlobalAgentsMd,
            disabled: savingCfg,
            onChange: (e) => void updateCfg({ injectCodexGlobalAgentsMd: e.target.checked })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-card um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-card-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { className: "um-card-title", children: t("overview.sessionsTitle", {
          active: overview.activeSessions.length,
          recent: nonActiveRecent.length
        }) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-muted", children: t("overview.sessionsSubtitle") })
      ] }),
      overview.activeSessions.length === 0 && nonActiveRecent.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "um-empty", children: t("overview.sessionsEmpty") }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-list", children: [
        overview.activeSessions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-item", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-row-between", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-badge success", children: t("overview.sessionActive") }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-mono", children: s.sessionId.slice(0, 14) }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-badge info", children: s.resolvedLocale }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: `um-badge ${s.baselineInjected ? "success" : "warn"}`, children: s.baselineInjected ? t("overview.sessionBaselineOn") : t("overview.sessionBaselineOff") }),
              s.compactionCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-badge warn", children: t("overview.sessionCompactions", { count: s.compactionCount }) }),
              s.hostDedupedCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-badge", children: t("overview.sessionDeduped", { count: s.hostDedupedCount }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-muted", children: fmtTime(s.updatedAt) }),
              (s.resolvedProjectRoot || s.cwd) && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "button",
                {
                  type: "button",
                  className: "um-btn sm",
                  onClick: () => onSelectRulesWorkspace(s.resolvedProjectRoot ?? s.cwd ?? "", s.sessionId),
                  children: t("overview.sessionInspectRules")
                }
              )
            ] })
          ] }),
          (s.cwd || s.resolvedProjectRoot) && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "um-mono um-muted", style: { marginTop: 4 }, children: s.cwd ?? s.resolvedProjectRoot })
        ] }, `live-${s.sessionId}`)),
        nonActiveRecent.slice(0, 10).map((s) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-item", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-row-between", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-badge", children: t("overview.sessionRecent") }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-mono", children: s.conversationId.slice(0, 14) }),
              s.locale && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-badge info", children: s.locale }),
              s.compactionCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-badge warn", children: t("overview.sessionCompactions", { count: s.compactionCount }) }),
              s.hostDedupedCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-badge", children: t("overview.sessionDeduped", { count: s.hostDedupedCount }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-muted", children: fmtTime(s.updatedAt) }),
              s.workspacePaths[0] && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "button",
                {
                  type: "button",
                  className: "um-btn sm",
                  onClick: () => onSelectRulesWorkspace(s.workspacePaths[0], s.conversationId),
                  children: t("overview.sessionInspectRules")
                }
              )
            ] })
          ] }),
          s.workspacePaths[0] && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "um-mono um-muted", style: { marginTop: 4 }, children: s.workspacePaths[0] })
        ] }, `recent-${s.conversationId}`))
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-card um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-card-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { className: "um-card-title", children: t("overview.diagnosticsTitle", { count: overview.diagnostics.length }) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "um-btn sm", onClick: () => void onRefresh(), children: t("common.refresh") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "button",
            {
              type: "button",
              className: "um-btn sm",
              onClick: () => void handleClearDiagnostics(),
              disabled: overview.diagnostics.length === 0,
              children: t("overview.clearLog")
            }
          )
        ] })
      ] }),
      overview.diagnostics.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "um-empty", children: t("overview.diagnosticsEmpty") }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "um-list", children: overview.diagnostics.slice(0, 25).map((ev, idx) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-item", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-row-between", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "um-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "span",
              {
                className: `um-badge ${ev.error ? "danger" : ev.event === "BaselineInject" || ev.event === "SessionStart" || ev.event.includes("pre-step") ? "success" : ev.event === "CompactionReload" || ev.event === "ManualReload" ? "warn" : "info"}`,
                children: ev.event
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "um-mono", children: [
              ev.elapsedMs.toFixed(1),
              " ms"
            ] }),
            ev.locale && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-badge info", children: ev.locale }),
            ev.compactionReload && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-badge warn", children: t("overview.compactionReload") }),
            typeof ev.hostDedupedCount === "number" && ev.hostDedupedCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-badge", children: t("overview.hostDedupedCount", { count: ev.hostDedupedCount }) }),
            ev.toolName && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-badge", children: ev.toolName })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-muted", children: fmtTime(ev.ts) })
        ] }),
        ev.injectedLabels.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "um-row", style: { marginTop: 6 }, children: ev.injectedLabels.map((lbl, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "um-badge", children: lbl }, `${lbl}-${i}`)) }),
        ev.error && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "um-mono", style: { color: "var(--um-danger-fg)", marginTop: 4 }, children: t("overview.errorPrefix", { error: ev.error }) })
      ] }, `${ev.ts}-${idx}`)) })
    ] })
  ] });
}

// src/client/components/RulesTab.tsx
var import_react5 = require("react");
var import_jsx_runtime6 = require("react/jsx-runtime");
function getSafeParentDir(targetPath) {
  const normalized = targetPath.replace(/[\\/]+$/, "");
  const idx = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  if (idx <= 0) return null;
  const parent = normalized.slice(0, idx);
  const segments = parent.split(/[\\/]/).filter(Boolean);
  if (segments.length <= 2 && (segments[0] === "Users" || segments[0] === "home") || segments.length <= 3 && /^[A-Za-z]:$/.test(segments[0]) && segments[1] === "Users") {
    return null;
  }
  return parent;
}
function RulesTab({
  workspaceHints,
  selectedWorkspace,
  selectedSessionId,
  onSelectWorkspace,
  t,
  onNotify
}) {
  const [inputPath, setInputPath] = (0, import_react5.useState)(selectedWorkspace || workspaceHints[0] || "");
  const [manualTrustPath, setManualTrustPath] = (0, import_react5.useState)("");
  const [data, setData] = (0, import_react5.useState)(null);
  const [loading, setLoading] = (0, import_react5.useState)(false);
  const [savingTrust, setSavingTrust] = (0, import_react5.useState)(false);
  const [expandedId, setExpandedId] = (0, import_react5.useState)(null);
  const inspect = (0, import_react5.useCallback)(
    async (wsPath, sessionId) => {
      setLoading(true);
      try {
        const res = await unifiedMemoryApi.inspectRules({
          workspacePath: wsPath.trim() || void 0,
          sessionId: sessionId || void 0
        });
        setData(res);
      } catch (err) {
        onNotify(err instanceof Error ? err.message : t("common.unknownError"), "danger");
      } finally {
        setLoading(false);
      }
    },
    [onNotify, t]
  );
  const updateExternalTrust = async (workspacePath, action, targetPath) => {
    setSavingTrust(true);
    try {
      await unifiedMemoryApi.updateTrust({
        workspacePath,
        action,
        ...targetPath ? { targetPath } : {}
      });
      await inspect(workspacePath, selectedSessionId);
      const msg = action === "allow" ? t("rules.trustApprovedToast") : action === "deny" ? t("rules.trustDeniedToast") : t("rules.trustUpdatedToast");
      onNotify(msg, action === "allow" ? "success" : "info");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : t("common.unknownError"), "danger");
    } finally {
      setSavingTrust(false);
    }
  };
  (0, import_react5.useEffect)(() => {
    const target = selectedWorkspace || workspaceHints[0] || "";
    setInputPath(target);
    void inspect(target, selectedSessionId);
  }, [selectedWorkspace, selectedSessionId, inspect]);
  const formatKindLabel = (kind) => t(`rules.kind.${kind}`);
  const formatBlockStatusLabel = (status) => t(`rules.blockStatus.${status}`);
  const formatApprovalSourceLabel = (source) => t(`rules.approvalSource.${source}`);
  const renderRuleCard = (rule) => {
    const isExpanded = expandedId === rule.id;
    const hasExpandedImports = rule.dedupedByHost && rule.importedOnlyContent.trim().length > 0;
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-item", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row-between", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: `um-badge ${rule.isConditional ? "warn" : "success"}`, children: rule.isConditional ? t("rules.badgePathScoped") : t("rules.badgeAlwaysOn") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge info", children: rule.scope }),
          rule.dedupedByHost ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge warn", children: t("rules.badgeHostDeduped") }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge success", children: t("rules.badgeLoadedByUm") }),
          hasExpandedImports && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge info", children: t("rules.badgeImportsExpanded") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-mono", children: rule.displayPath })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "um-muted", children: [
            rule.sizeBytes,
            " B"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "button",
            {
              type: "button",
              className: "um-btn sm",
              onClick: () => setExpandedId(isExpanded ? null : rule.id),
              children: isExpanded ? t("common.hide") : t("common.preview")
            }
          )
        ] })
      ] }),
      rule.paths && rule.paths.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row", style: { marginTop: 6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-muted", children: t("rules.pathsLabel") }),
        rule.paths.map((p) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge um-mono", children: p }, p))
      ] }),
      rule.imports.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row", style: { marginTop: 6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-muted", children: t("rules.importsLabel", { count: rule.imports.length }) }),
        rule.imports.map((imp) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge info um-mono", children: imp }, imp))
      ] }),
      rule.skippedDuplicateAgentsMd.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "um-row", style: { marginTop: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge warn", children: t("rules.badgeDedupedAgents", { count: rule.skippedDuplicateAgentsMd.length }) }) }),
      rule.blockedExternalTargets.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "um-row", style: { marginTop: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge danger", children: t("rules.badgeBlockedExternal", { count: rule.blockedExternalTargets.length }) }) }),
      isExpanded && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { marginTop: 8 }, children: [
        hasExpandedImports && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "um-muted", style: { marginBottom: 4 }, children: t("rules.importedOnlyNote") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("pre", { className: "um-pre", style: { marginBottom: 8 }, children: rule.importedOnlyContent }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "um-muted", style: { marginBottom: 4 }, children: t("rules.fullContentNote") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("pre", { className: "um-pre", children: rule.content })
      ] })
    ] }, rule.id);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-card um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-card-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { className: "um-card-title", children: t("rules.inspectorTitle") }),
        data && data.hostLoadedPaths.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge warn", children: t("overview.sessionDeduped", { count: data.hostLoadedPaths.length }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "input",
          {
            className: "um-input",
            style: { flex: 1, minWidth: 200 },
            value: inputPath,
            onChange: (e) => setInputPath(e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") {
                onSelectWorkspace(inputPath.trim());
                void inspect(inputPath, selectedSessionId);
              }
            },
            placeholder: t("rules.workspacePlaceholder"),
            list: "um-dsh-rules-ws-hints"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("datalist", { id: "um-dsh-rules-ws-hints", children: workspaceHints.map((h) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: h }, h)) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "button",
          {
            type: "button",
            className: "um-btn primary",
            disabled: loading,
            onClick: () => {
              onSelectWorkspace(inputPath.trim());
              void inspect(inputPath, selectedSessionId);
            },
            children: loading ? t("rules.scanning") : t("rules.inspect")
          }
        )
      ] })
    ] }),
    data && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-card um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-card-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { className: "um-card-title", children: t("rules.globalTitle", {
          count: data.globalAlwaysOn.length + data.globalConditional.length
        }) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-muted", children: t("rules.globalSubtitle") })
      ] }),
      data.globalAlwaysOn.length + data.globalConditional.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "um-empty", children: t("rules.globalEmpty") }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-list", children: [
        data.globalAlwaysOn.map(renderRuleCard),
        data.globalConditional.map(renderRuleCard)
      ] })
    ] }),
    data?.workspace && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-card um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-card-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { className: "um-card-title", children: t("rules.trustTitle") }),
          data.workspace.claudeCodeExternalApproval?.approved ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge success", children: data.trustClaudeCodeExternalApprovals ? t("rules.claudeCodeApprovedActive") : t("rules.claudeCodeApprovedIgnored") }) : data.workspace.claudeCodeExternalApproval?.warningShown ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge warn", children: t("rules.claudeCodeDeclined") }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge", children: t("rules.claudeCodeNotApproved") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-muted", children: t("rules.trustSubtitle") })
      ] }),
      data.workspace.blockedExternalTargets.length === 0 && data.workspace.approvedExternalTargets.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "um-muted", style: { marginBottom: 10 }, children: t("rules.noExternalTargets") }),
      data.workspace.blockedExternalTargets.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { marginBottom: 10 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "um-muted", style: { marginBottom: 6 }, children: t("rules.blockedTitle", { count: data.workspace.blockedExternalTargets.length }) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "um-list", children: data.workspace.blockedExternalTargets.map((item) => {
          const parentDir = item.targetIsDir ? null : getSafeParentDir(item.resolvedTarget);
          const wsRoot = data.workspace.workspaceRoot;
          return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
            "div",
            {
              className: "um-item",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row-between", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                      "span",
                      {
                        className: `um-badge ${item.status === "pending_approval" ? "danger" : "warn"}`,
                        children: formatBlockStatusLabel(item.status)
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge info", children: formatKindLabel(item.kind) }),
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-mono", children: item.sourceDisplayPath }),
                    item.rawRef && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "um-muted um-mono", children: [
                      "\u2192 @",
                      item.rawRef
                    ] })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                      "button",
                      {
                        type: "button",
                        className: "um-btn sm primary",
                        disabled: savingTrust,
                        onClick: () => void updateExternalTrust(wsRoot, "allow", item.resolvedTarget),
                        children: item.targetIsDir ? t("rules.approveDir") : t("rules.approveFile")
                      }
                    ),
                    parentDir && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                      "button",
                      {
                        type: "button",
                        className: "um-btn sm",
                        disabled: savingTrust,
                        title: parentDir,
                        onClick: () => void updateExternalTrust(wsRoot, "allow", parentDir),
                        children: t("rules.approveParentDir")
                      }
                    ),
                    item.status === "denied_by_plugin" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                      "button",
                      {
                        type: "button",
                        className: "um-btn sm",
                        disabled: savingTrust,
                        onClick: () => void updateExternalTrust(wsRoot, "revoke", item.resolvedTarget),
                        children: t("rules.resetTarget")
                      }
                    ) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                      "button",
                      {
                        type: "button",
                        className: "um-btn sm",
                        disabled: savingTrust,
                        onClick: () => void updateExternalTrust(wsRoot, "deny", item.resolvedTarget),
                        children: t("rules.dismissTarget")
                      }
                    )
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "um-mono um-muted", style: { marginTop: 4 }, children: t("rules.targetPrefix", { target: item.resolvedTarget }) })
              ]
            },
            `${item.kind}-${item.sourceFile}-${item.resolvedTarget}`
          );
        }) })
      ] }),
      data.workspace.approvedExternalTargets.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { marginBottom: 10 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "um-muted", style: { marginBottom: 6 }, children: t("rules.activeApprovedTitle", {
          count: data.workspace.approvedExternalTargets.length
        }) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "um-list", children: data.workspace.approvedExternalTargets.map((item) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          "div",
          {
            className: "um-item",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row-between", children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge success", children: formatApprovalSourceLabel(item.approvedBy) }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge info", children: formatKindLabel(item.kind) }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-mono", children: item.sourceDisplayPath })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "um-btn sm danger",
                    disabled: savingTrust,
                    onClick: () => void updateExternalTrust(
                      data.workspace.workspaceRoot,
                      "deny",
                      item.resolvedTarget
                    ),
                    children: t("rules.blockTarget")
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "um-mono um-muted", style: { marginTop: 4 }, children: t("rules.targetPrefix", { target: item.resolvedTarget }) })
            ]
          },
          `${item.kind}-${item.sourceDisplayPath}-${item.resolvedTarget}`
        )) })
      ] }),
      (data.workspaceExternalTrust.allowPaths.length > 0 || data.workspaceExternalTrust.denyPaths.length > 0) && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { marginBottom: 10 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row-between", style: { marginBottom: 6 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-muted", children: t("rules.savedOverridesTitle") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "button",
            {
              type: "button",
              className: "um-btn sm",
              disabled: savingTrust,
              onClick: () => void updateExternalTrust(data.workspace.workspaceRoot, "clear_workspace"),
              children: t("rules.clearAllOverrides")
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-list", children: [
          data.workspaceExternalTrust.allowPaths.map((p) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-item um-row-between", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge success", children: t("rules.allowBadge") }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-mono", children: p })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "button",
              {
                type: "button",
                className: "um-btn sm",
                disabled: savingTrust,
                onClick: () => void updateExternalTrust(data.workspace.workspaceRoot, "revoke", p),
                children: t("rules.revokeTarget")
              }
            )
          ] }, `allow-${p}`)),
          data.workspaceExternalTrust.denyPaths.map((p) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-item um-row-between", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge danger", children: t("rules.denyBadge") }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-mono", children: p })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "button",
              {
                type: "button",
                className: "um-btn sm",
                disabled: savingTrust,
                onClick: () => void updateExternalTrust(data.workspace.workspaceRoot, "revoke", p),
                children: t("rules.revokeTarget")
              }
            )
          ] }, `deny-${p}`))
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "input",
          {
            className: "um-input",
            style: { flex: 1, minWidth: 200 },
            value: manualTrustPath,
            onChange: (e) => setManualTrustPath(e.target.value),
            placeholder: t("rules.manualPlaceholder")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "button",
          {
            type: "button",
            className: "um-btn sm primary",
            disabled: savingTrust || !manualTrustPath.trim(),
            onClick: async () => {
              const target = manualTrustPath.trim();
              if (!target) return;
              await updateExternalTrust(data.workspace.workspaceRoot, "allow", target);
              setManualTrustPath("");
            },
            children: t("rules.allowPathBtn")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "button",
          {
            type: "button",
            className: "um-btn sm",
            disabled: savingTrust || !manualTrustPath.trim(),
            onClick: async () => {
              const target = manualTrustPath.trim();
              if (!target) return;
              await updateExternalTrust(data.workspace.workspaceRoot, "deny", target);
              setManualTrustPath("");
            },
            children: t("rules.denyPathBtn")
          }
        )
      ] })
    ] }),
    data?.workspace && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-card um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-card-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { className: "um-card-title", children: t("rules.workspaceTitle", {
          alwaysOn: data.workspace.alwaysOn.length,
          conditional: data.workspace.conditional.length
        }) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-mono um-muted", children: data.workspace.workspaceRoot })
      ] }),
      data.workspace.alwaysOn.length + data.workspace.conditional.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "um-empty", children: t("rules.workspaceEmpty") }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-list", children: [
        data.workspace.alwaysOn.map(renderRuleCard),
        data.workspace.conditional.map(renderRuleCard)
      ] }),
      data.workspace.excludedPaths.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { marginTop: 10 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "um-muted", style: { marginBottom: 4 }, children: t("rules.excludedTitle") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "um-row", children: data.workspace.excludedPaths.map((p) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge danger um-mono", children: p }, p)) })
      ] })
    ] }),
    data && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-card um-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-card-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { className: "um-card-title", children: t("rules.lazyHitsTitle", { count: data.recentSessionHits.length }) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-muted", children: t("rules.lazyHitsSubtitle") })
      ] }),
      data.recentSessionHits.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "um-empty", children: t("rules.lazyHitsEmpty") }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "um-list", children: data.recentSessionHits.map((s) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-item", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row-between", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-mono", children: s.conversationId.slice(0, 14) }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row", children: [
            s.hostDedupedPaths.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge", children: t("overview.sessionDeduped", { count: s.hostDedupedPaths.length }) }),
            s.compactionCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge warn", children: t("overview.sessionCompactions", { count: s.compactionCount }) }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-muted", children: s.updatedAt.slice(0, 19).replace("T", " ") })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "um-row", style: { marginTop: 6 }, children: [
          s.loadedRuleKeys.map((k) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge info um-mono", children: t("rules.hitRulePrefix", { key: k }) }, k)),
          s.loadedSubdirPaths.map((k) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "um-badge success um-mono", children: t("rules.hitSubdirPrefix", { key: k }) }, k))
        ] })
      ] }, s.conversationId)) })
    ] })
  ] });
}

// src/client/components/UnifiedMemoryConsole.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
function UnifiedMemoryConsole(props) {
  const { t: slotT, useSessions } = props;
  const t = (0, import_react6.useMemo)(() => slotT ?? createFallbackTranslator("en"), [slotT]);
  const activeSessionEncoded = useSessions ? useSessions((state) => {
    const entries = Object.values(state.byId);
    const main = entries.find((s) => s && (s.retainedBy?.mainView ?? 0) > 0);
    const chosen = main ?? entries.find((s) => Boolean(s?.cwd));
    return chosen ? `${chosen.id}\0${chosen.cwd ?? ""}` : "";
  }) : "";
  const [activeSessionId, activeSessionCwd] = (0, import_react6.useMemo)(() => {
    if (!activeSessionEncoded) return [void 0, void 0];
    const sep = activeSessionEncoded.indexOf("\0");
    if (sep < 0) return [activeSessionEncoded, void 0];
    const id = activeSessionEncoded.slice(0, sep) || void 0;
    const cwd = activeSessionEncoded.slice(sep + 1) || void 0;
    return [id, cwd];
  }, [activeSessionEncoded]);
  const [tab, setTab] = (0, import_react6.useState)("overview");
  const [overview, setOverview] = (0, import_react6.useState)(null);
  const [selectedSlug, setSelectedSlug] = (0, import_react6.useState)("");
  const [selectedWorkspace, setSelectedWorkspace] = (0, import_react6.useState)("");
  const [selectedRulesSessionId, setSelectedRulesSessionId] = (0, import_react6.useState)(
    void 0
  );
  const [loading, setLoading] = (0, import_react6.useState)(true);
  const [loadError, setLoadError] = (0, import_react6.useState)(null);
  const [toast, setToast] = (0, import_react6.useState)(null);
  const notify = (0, import_react6.useCallback)((msg, tone = "info") => {
    setToast({ msg, tone });
  }, []);
  (0, import_react6.useEffect)(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const applyOverview = (0, import_react6.useCallback)(
    (data) => {
      setOverview(data);
      setLoadError(null);
      setLoading(false);
      const defaultWs = activeSessionCwd || data.workspaceHints[0] || "";
      if (defaultWs) {
        setSelectedWorkspace((prev) => prev || defaultWs);
      }
      if (!selectedRulesSessionId && (activeSessionId || data.activeSessions[0]?.sessionId)) {
        setSelectedRulesSessionId(activeSessionId ?? data.activeSessions[0]?.sessionId);
      }
      if (data.claude.projects.length > 0) {
        const activeSlug = data.activeSessions.find((s) => s.sessionId === activeSessionId)?.claudeSlug;
        setSelectedSlug((prev) => prev || activeSlug || data.claude.projects[0].slug);
      }
    },
    [activeSessionCwd, activeSessionId, selectedRulesSessionId]
  );
  const refreshOverview = (0, import_react6.useCallback)(async () => {
    setLoading(true);
    try {
      const data = await unifiedMemoryApi.getOverview(activeSessionCwd);
      applyOverview(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("common.unknownError");
      setLoadError(msg);
      notify(t("panel.errorLoad", { message: msg }), "danger");
      setLoading(false);
    }
  }, [activeSessionCwd, applyOverview, notify, t]);
  (0, import_react6.useEffect)(() => {
    void refreshOverview();
  }, [refreshOverview]);
  const mergedWorkspaceHints = (0, import_react6.useMemo)(() => {
    const set = /* @__PURE__ */ new Set();
    if (activeSessionCwd) set.add(activeSessionCwd);
    for (const h of overview?.workspaceHints ?? []) set.add(h);
    return Array.from(set);
  }, [activeSessionCwd, overview?.workspaceHints]);
  const projectHintName = (0, import_react6.useMemo)(() => {
    const ws = selectedWorkspace || activeSessionCwd || "";
    if (!ws) return "";
    return ws.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "";
  }, [selectedWorkspace, activeSessionCwd]);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "um-dsh-console", "data-unified-memory-console": true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("header", { className: "um-dsh-console-header", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "um-dsh-console-header-inner", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "um-dsh-header-top", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "um-dsh-brand", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "um-dsh-brand-icon", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MemoryGlyph, { size: 17 }) }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "um-dsh-title-group", children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "um-dsh-title-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h1", { className: "um-dsh-title", children: t("panel.title") }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "um-badge", children: [
                "v",
                overview?.version ?? PLUGIN_VERSION
              ] }),
              overview && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "um-badge info", children: overview.resolvedLocale })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "um-dsh-subtitle", children: t("panel.subtitle") })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "um-row", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
          "button",
          {
            type: "button",
            className: "um-btn sm",
            onClick: () => void refreshOverview(),
            disabled: loading,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(RefreshIcon, { size: 12 }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: loading ? t("panel.syncing") : t("panel.sync") })
            ]
          }
        ) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("nav", { className: "um-dsh-tabs", "aria-label": t("tabs.ariaLabel"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "button",
          {
            type: "button",
            className: `um-dsh-tab ${tab === "overview" ? "active" : ""}`,
            onClick: () => setTab("overview"),
            children: t("tabs.overview")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "button",
          {
            type: "button",
            className: `um-dsh-tab ${tab === "claude" ? "active" : ""}`,
            onClick: () => setTab("claude"),
            children: t("tabs.claude", { count: overview?.claude.totalTopics ?? 0 })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "button",
          {
            type: "button",
            className: `um-dsh-tab ${tab === "codex" ? "active" : ""}`,
            onClick: () => setTab("codex"),
            children: t("tabs.codex")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "button",
          {
            type: "button",
            className: `um-dsh-tab ${tab === "rules" ? "active" : ""}`,
            onClick: () => setTab("rules"),
            children: t("tabs.rules")
          }
        )
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("main", { className: "um-dsh-console-body", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "um-dsh-console-inner", children: [
      toast && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: `um-banner ${toast.tone}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: toast.msg }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "um-btn sm", onClick: () => setToast(null), children: t("panel.dismiss") })
      ] }),
      loadError && !overview && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "um-banner danger", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: t("panel.errorLoad", { message: loadError }) }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "um-btn sm", onClick: () => void refreshOverview(), children: t("common.refresh") })
      ] }),
      !overview ? !loadError && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "um-empty", children: t("panel.loading") }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
        tab === "overview" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          OverviewTab,
          {
            overview,
            t,
            onRefresh: refreshOverview,
            onSelectClaudeProject: (slug) => {
              setSelectedSlug(slug);
              setTab("claude");
            },
            onSelectRulesWorkspace: (wsPath, sessionId) => {
              setSelectedWorkspace(wsPath);
              if (sessionId) setSelectedRulesSessionId(sessionId);
              setTab("rules");
            },
            onNotify: notify
          }
        ),
        tab === "claude" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          ClaudeTab,
          {
            projects: overview.claude.projects,
            selectedSlug,
            onSelectSlug: setSelectedSlug,
            t,
            onOverviewRefresh: refreshOverview,
            onNotify: notify
          }
        ),
        tab === "codex" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          CodexTab,
          {
            defaultProjectHint: projectHintName,
            t,
            onNotify: notify
          }
        ),
        tab === "rules" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          RulesTab,
          {
            workspaceHints: mergedWorkspaceHints,
            selectedWorkspace,
            selectedSessionId: selectedRulesSessionId,
            onSelectWorkspace: setSelectedWorkspace,
            t,
            onNotify: notify
          }
        )
      ] })
    ] }) })
  ] });
}

// src/client/styles.ts
var CLIENT_PLUGIN_ID = "unified-memory-dsh";
var CLIENT_STYLE_ID = "unified-memory-dsh/styles.css";
var CLIENT_STYLES_CSS = `
.um-dsh-console,
.um-dsh-right-tab,
.um-dsh-modal-backdrop {
  --um-bg: var(--dsw-alias-bg-base, #ffffff);
  --um-bg-card: var(--dsw-alias-card-fill, #fafafa);
  --um-bg-layer: var(--dsw-alias-bg-layer-1, #ffffff);
  --um-bg-hover: var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, 0.06));
  --um-bg-code: var(--dsw-alias-markdown-code-block, #f5f7fa);
  --um-text: var(--dsw-alias-label-primary, #0f1115);
  --um-text-2: var(--dsw-alias-label-secondary, #61666b);
  --um-text-3: var(--dsw-alias-label-tertiary, #81858c);
  --um-border: var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.12));
  --um-border-subtle: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));
  --um-border-strong: var(--dsw-alias-border-l4, rgba(0, 0, 0, 0.16));
  --um-accent: var(--dsw-alias-state-business-primary, #4176e6);
  --um-accent-bg: var(--dsw-alias-state-business-tertiary, #e4edfd);
  --um-btn-primary-bg: var(--dsw-alias-button-primary-fill, #0f1115);
  --um-btn-primary-hover: var(--dsw-alias-button-primary-hover, #43454a);
  --um-btn-primary-fg: var(--dsw-alias-label-primary-foreground, #ffffff);
  --um-success-bg: var(--dsw-alias-state-success-tertiary, #e6faed);
  --um-success-fg: #15803d;
  --um-warn-bg: var(--dsw-alias-state-warn-tertiary, #fef5e7);
  --um-warn-fg: var(--dsw-alias-state-warn-label, #b45309);
  --um-danger-bg: var(--dsw-alias-code-diff-deleted, rgba(236, 19, 19, 0.09));
  --um-danger-fg: var(--dsw-alias-state-error-primary, #dc2626);
  --um-font: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif);
  --um-mono: var(--ds-font-family-code, "SF Mono", Menlo, Consolas, "PingFang SC", "Microsoft YaHei");
  --um-radius-sm: var(--dsw-radius-sm, 8px);
  --um-radius-md: var(--dsw-radius-md, 12px);
  --um-radius-xs: var(--dsw-radius-xs, 4px);
  font-family: var(--um-font);
  color: var(--um-text);
  font-size: 13px;
  line-height: 1.5;
  box-sizing: border-box;
}

body[data-ds-dark-theme] .um-dsh-console,
body[data-ds-dark-theme] .um-dsh-right-tab,
body[data-ds-dark-theme] .um-dsh-modal-backdrop {
  --um-success-fg: var(--dsw-alias-state-success-secondary, #4ed17e);
  --um-warn-fg: var(--dsw-alias-state-warn-secondary, #f7ad31);
  --um-danger-fg: var(--dsw-alias-state-error-primary, #f25a5a);
}

.um-dsh-console *,
.um-dsh-right-tab *,
.um-dsh-modal-backdrop * {
  box-sizing: border-box;
}

/* Main Left-Sidebar Console layout */
.um-dsh-console {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  width: 100%;
  background: var(--um-bg);
  overflow: hidden;
}

.um-dsh-console-header {
  flex: none;
  border-bottom: 1px solid var(--um-border-subtle);
  background: var(--um-bg);
  padding: 18px clamp(20px, 3.5vw, 40px) 0;
  padding-inline-start: max(clamp(20px, 3.5vw, 40px), calc(var(--dsh-frame-leading-clearance, 0px) + 12px));
}

.um-dsh-console-header-inner {
  max-width: 1040px;
  margin: 0 auto;
  width: 100%;
}

.um-dsh-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.um-dsh-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.um-dsh-brand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--um-radius-sm);
  background: var(--um-accent-bg);
  color: var(--um-accent);
  flex-shrink: 0;
}

.um-dsh-title-group {
  min-width: 0;
}

.um-dsh-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.um-dsh-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--um-text);
}

.um-dsh-subtitle {
  margin: 1px 0 0;
  font-size: 12px;
  color: var(--um-text-3);
}

.um-dsh-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.um-dsh-tab {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--um-text-2);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 12px 10px;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.12s ease, border-color 0.12s ease;
}

.um-dsh-tab:hover {
  color: var(--um-text);
}

.um-dsh-tab.active {
  color: var(--um-accent);
  border-bottom-color: var(--um-accent);
  font-weight: 600;
}

.um-dsh-console-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 18px clamp(20px, 3.5vw, 40px) 40px;
}

.um-dsh-console-inner {
  max-width: 1040px;
  margin: 0 auto;
  width: 100%;
}

/* Shared cards, grids, controls */
.um-grid-2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.um-section + .um-section,
.um-card + .um-card {
  margin-top: 12px;
}

.um-card {
  background: var(--um-bg-card);
  border: 1px solid var(--um-border-subtle);
  border-radius: var(--um-radius-md);
  padding: 14px 16px;
}

.um-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.um-card-title {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--um-text);
}

.um-muted {
  color: var(--um-text-2);
  font-size: 12px;
}

.um-caption {
  color: var(--um-text-3);
  font-size: 11.5px;
}

.um-mono {
  font-family: var(--um-mono);
  font-size: 11.5px;
  word-break: break-all;
}

.um-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.um-row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.um-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  background: var(--um-bg-hover);
  color: var(--um-text-2);
  max-width: 100%;
}

.um-badge.info {
  background: var(--um-accent-bg);
  color: var(--um-accent);
}

.um-badge.success {
  background: var(--um-success-bg);
  color: var(--um-success-fg);
}

.um-badge.warn {
  background: var(--um-warn-bg);
  color: var(--um-warn-fg);
}

.um-badge.danger {
  background: var(--um-danger-bg);
  color: var(--um-danger-fg);
}

.um-btn {
  appearance: none;
  border: 1px solid var(--um-border);
  background: var(--um-bg-layer);
  color: var(--um-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 11px;
  border-radius: var(--um-radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  transition: background-color 0.12s ease, border-color 0.12s ease, opacity 0.12s ease;
}

.um-btn:hover:not(:disabled) {
  background: var(--um-bg-hover);
  border-color: var(--um-border-strong);
}

.um-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.um-btn.primary {
  background: var(--um-btn-primary-bg);
  border-color: var(--um-btn-primary-bg);
  color: var(--um-btn-primary-fg);
}

.um-btn.primary:hover:not(:disabled) {
  background: var(--um-btn-primary-hover);
  border-color: var(--um-btn-primary-hover);
}

.um-btn.accent {
  background: var(--um-accent);
  border-color: var(--um-accent);
  color: #ffffff;
}

.um-btn.accent:hover:not(:disabled) {
  filter: brightness(1.06);
}

.um-btn.danger {
  color: var(--um-danger-fg);
  border-color: transparent;
  background: var(--um-danger-bg);
}

.um-btn.danger:hover:not(:disabled) {
  filter: brightness(0.96);
}

.um-btn.sm {
  padding: 3px 8px;
  font-size: 11.5px;
}

.um-input,
.um-select,
.um-textarea {
  width: 100%;
  background: var(--um-bg-layer);
  color: var(--um-text);
  border: 1px solid var(--um-border);
  border-radius: var(--um-radius-sm);
  padding: 6px 10px;
  font-family: inherit;
  font-size: 12.5px;
  transition: border-color 0.12s ease;
}

.um-textarea {
  font-family: var(--um-mono);
  font-size: 12px;
  resize: vertical;
  min-height: 140px;
}

.um-input:focus,
.um-select:focus,
.um-textarea:focus {
  outline: none;
  border-color: var(--um-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--um-accent) 22%, transparent);
}

.um-pill-bar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.um-pill {
  appearance: none;
  border: 1px solid var(--um-border-subtle);
  background: var(--um-bg-layer);
  color: var(--um-text-2);
  border-radius: 999px;
  padding: 3px 10px;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.um-pill:hover {
  color: var(--um-text);
  background: var(--um-bg-hover);
}

.um-pill.active {
  background: var(--um-accent-bg);
  color: var(--um-accent);
  border-color: transparent;
  font-weight: 600;
}

.um-progress-track {
  width: 100%;
  height: 7px;
  background: var(--um-bg-hover);
  border-radius: 999px;
  overflow: hidden;
  margin-top: 4px;
}

.um-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--um-accent);
  transition: width 0.2s ease;
}

.um-progress-fill.warn {
  background: var(--dsw-alias-state-warn-primary, #f59e0b);
}

.um-progress-fill.danger {
  background: var(--um-danger-fg);
}

.um-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.um-item {
  background: var(--um-bg-layer);
  border: 1px solid var(--um-border-subtle);
  border-radius: var(--um-radius-sm);
  padding: 10px 12px;
}

.um-item-hover {
  cursor: pointer;
  transition: border-color 0.12s ease, background-color 0.12s ease;
}

.um-item-hover:hover {
  border-color: var(--um-accent);
}

.um-pre {
  margin: 8px 0 0;
  padding: 10px 12px;
  background: var(--um-bg-code);
  border: 1px solid var(--um-border-subtle);
  border-radius: var(--um-radius-sm);
  font-family: var(--um-mono);
  font-size: 11.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 420px;
  overflow: auto;
  color: var(--um-text);
}

.um-banner {
  padding: 9px 12px;
  border-radius: var(--um-radius-sm);
  font-size: 12px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.um-banner.info {
  background: var(--um-accent-bg);
  color: var(--um-accent);
}

.um-banner.warn {
  background: var(--um-warn-bg);
  color: var(--um-warn-fg);
}

.um-banner.danger {
  background: var(--um-danger-bg);
  color: var(--um-danger-fg);
}

.um-banner.success {
  background: var(--um-success-bg);
  color: var(--um-success-fg);
}

.um-kv {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 5px 10px;
  font-size: 12px;
  align-items: baseline;
}

.um-kv-key {
  color: var(--um-text-3);
}

.um-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 0;
  border-bottom: 1px solid var(--um-border-subtle);
}

.um-toggle:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.um-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--um-accent);
  cursor: pointer;
  flex-shrink: 0;
}

.um-field {
  margin-bottom: 11px;
}

.um-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--um-text-2);
}

.um-empty {
  text-align: center;
  padding: 22px 12px;
  color: var(--um-text-3);
  font-size: 12.5px;
}

/* Modal */
.um-dsh-modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--dsw-alias-bg-mask-3, rgba(0, 0, 0, 0.48));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 200;
}

.um-dsh-modal {
  background: var(--um-bg-layer);
  border: 1px solid var(--um-border);
  border-radius: var(--um-radius-md);
  width: 100%;
  max-width: 660px;
  max-height: 90vh;
  overflow: auto;
  padding: 18px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.24);
}

/* Right Sidebar Per-Session Tab */
.um-dsh-right-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  background: var(--um-bg);
}

.um-dsh-right-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  height: 38px;
  flex: none;
  padding: 0 10px 0 12px;
  border-bottom: 1px solid var(--um-border-subtle);
}

.um-dsh-right-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--um-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.um-dsh-right-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.um-dsh-right-card {
  background: var(--um-bg-card);
  border: 1px solid var(--um-border-subtle);
  border-radius: var(--um-radius-sm);
  padding: 10px 11px;
}

.um-dsh-right-section-title {
  margin: 0 0 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--um-text-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.um-dsh-right-kv {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 4px 8px;
  font-size: 11.5px;
  align-items: baseline;
}

.um-dsh-chip-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.um-dsh-chip-row {
  background: var(--um-bg-layer);
  border: 1px solid var(--um-border-subtle);
  border-radius: var(--um-radius-xs);
  padding: 5px 8px;
  font-size: 11.5px;
}

.um-dsh-tab-title-icon {
  flex: none;
  vertical-align: middle;
}

@media (max-width: 640px) {
  .um-kv {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  .um-dsh-console-header {
    padding: 14px 14px 0;
  }
  .um-dsh-console-body {
    padding: 14px 14px 32px;
  }
}
`;

// src/client/index.ts
var NS = CLIENT_LOCALE_NS;
var PANEL_ID = "unified-memory";
var RIGHT_TAB_ID = PLUGIN_ID;
var RIGHT_TAB_KIND = "unified-memory";
var inject = ["slots", "locale", "layout"];
function installScopedStyles(ctx) {
  if (typeof document === "undefined") return;
  ctx.effect(() => {
    const existing = document.querySelector(
      `style[data-plugin-css=${JSON.stringify(CLIENT_STYLE_ID)}]`
    );
    if (existing) {
      existing.textContent = CLIENT_STYLES_CSS;
      return () => {
        existing.remove();
      };
    }
    const tag = document.createElement("style");
    tag.dataset.plugin = CLIENT_PLUGIN_ID;
    tag.dataset.pluginCss = CLIENT_STYLE_ID;
    tag.textContent = CLIENT_STYLES_CSS;
    document.head.appendChild(tag);
    return () => {
      tag.remove();
    };
  }, "unified-memory: scoped stylesheet");
}
function apply(rawCtx) {
  const ctx = rawCtx;
  installScopedStyles(ctx);
  ctx.effect(
    () => ctx.locale.register(NS, { zh, en }),
    "unified-memory: bilingual client dictionaries"
  );
  const t = ctx.locale.bind(NS);
  ctx.effect(
    () => ctx.slots.inject(
      "main",
      () => ctx.slots.register(
        {
          name: "main",
          key: PANEL_ID,
          locale: NS,
          inject: () => ({
            getActiveLocale: () => ctx.locale.getLocale().active
          })
        },
        UnifiedMemoryConsole
      )
    ),
    "unified-memory: main console panel"
  );
  ctx.effect(
    () => ctx.slots.inject(
      "sidebar.panellist",
      () => ctx.slots.register(
        {
          name: "sidebar.panellist",
          id: PANEL_ID,
          order: 20,
          label: () => t("panel.navLabel"),
          locale: NS
        },
        MemoryPanelIcon
      )
    ),
    "unified-memory: left sidebar navigation entry"
  );
  ctx.inject(["sidebarRightTabs"], (rawScope) => {
    const scope = rawScope;
    const registry = scope.sidebarRightTabs;
    if (!registry) return;
    scope.effect(
      () => registry.register({
        id: RIGHT_TAB_ID,
        kind: RIGHT_TAB_KIND,
        priority: "extension",
        title: () => t("rightTab.title"),
        guide: [
          {
            id: "memory-context",
            order: 40,
            title: () => t("rightTab.guideTitle"),
            description: () => t("rightTab.guideDescription"),
            icon: MemoryGuideIcon
          }
        ]
      }),
      "unified-memory: right sidebar tab type"
    );
    scope.effect(
      () => scope.slots.inject(
        "sidebar.right.pane.tab",
        () => scope.slots.register(
          {
            name: "sidebar.right.pane.tab",
            key: RIGHT_TAB_ID,
            locale: NS,
            inject: () => ({
              openGlobalConsole: () => {
                ctx.layout.selectPanel(PANEL_ID);
              }
            })
          },
          SessionContextTab
        )
      ),
      "unified-memory: right sidebar tab body"
    );
    scope.effect(
      () => scope.slots.inject(
        "sidebar.right.pane.tab.title",
        () => scope.slots.register(
          {
            name: "sidebar.right.pane.tab.title",
            key: RIGHT_TAB_ID,
            locale: NS
          },
          SessionContextTitle
        )
      ),
      "unified-memory: right sidebar tab title"
    );
  });
}

if(module.exports&&typeof module.exports==="object"&&!(Symbol.toStringTag in module.exports)){
Object.defineProperty(module.exports,Symbol.toStringTag,{value:"Module"});
}
return module.exports;
}});
