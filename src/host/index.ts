import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type {} from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-working-directory';
import { registerSlashCommands } from './commands.js';
import { registerContextLifecycle } from './context.js';
import { registerGuidanceSection } from './guidance.js';
import { registerHttpRoutes } from './routes.js';
import { createHostRuntime, type HostPluginConfig } from './runtime.js';
import { registerBundledSkills } from './skills.js';
import { registerHostTools } from './tools.js';

export const name = 'unified-memory';

/**
 * Hard runtime dependencies only — ensures this bundle activates cleanly across
 * all 5 DSH profiles (`web`, `desktop`, `headless`, `acp`, `sdk`). Optional
 * services (`systemPrompt`, `commands`, `skills`, `connection`, `settings`) are
 * mounted via isolated `ctx.inject([...])` sub-effects.
 */
export const inject = ['agents', 'tools', 'workingDirectory'] as const;

export const Config = z.object({
  locale: z
    .union([z.const('auto'), z.const('zh'), z.const('en')])
    .default('auto')
    .volatile()
    .description('Display and prompt-header language (auto | zh | en).'),
  injectCodexSummaryOnStart: z
    .boolean()
    .default(true)
    .volatile()
    .description('Inject read-only Codex memory_summary.md on session baseline.'),
  codexSummaryMaxBytes: z
    .number()
    .min(512)
    .max(65536)
    .default(8192)
    .volatile()
    .description('Maximum byte budget for read-only Codex memory_summary.md injection.'),
  injectCodexGlobalAgentsMd: z
    .boolean()
    .default(false)
    .volatile()
    .description('Also inject ~/.codex/AGENTS.md (or AGENTS.override.md) on startup.'),
  deduplicateNativeAgentsMd: z
    .boolean()
    .default(true)
    .volatile()
    .description('Deduplicate AGENTS.md / host-loaded CLAUDE.md files against dsh-agent-instructions.'),
  trustClaudeCodeExternalApprovals: z
    .boolean()
    .default(true)
    .volatile()
    .description('Reuse existing Claude Code project external-import approvals when present.'),
  maxStartupInjectBytes: z
    .number()
    .min(4096)
    .max(262144)
    .default(65536)
    .volatile()
    .description('Total byte cap for Unified Memory baseline context injection.'),
  dataDir: z
    .string()
    .description('Optional explicit storage directory override (defaults to $DSH_HOME/storages/unified-memory).'),
});

export function apply(ctx: Context, config?: HostPluginConfig): void {
  const runtime = createHostRuntime(ctx, config);

  // Core host lifecycle & tools (always mounted)
  registerContextLifecycle(ctx, runtime);
  registerHostTools(ctx, runtime);

  // Profile-optional capabilities (mounted via isolated ctx.inject sub-effects)
  registerGuidanceSection(ctx);
  registerSlashCommands(ctx, runtime);
  registerBundledSkills(ctx);
  registerHttpRoutes(ctx, runtime);

  ctx.logger.debug('unified-memory host plugin initialized (dataDir=%s)', runtime.dataDir);
}

export default { name, inject, Config, apply };

export { createHostRuntime, type HostPluginConfig, type HostRuntime } from './runtime.js';
export {
  UNIFIED_MEMORY_SOURCE_KIND,
  escapeSystemReminder,
  extractFilePathsFromExecution,
  extractHostLoadedPaths,
  wrapSystemReminder,
} from './context.js';
export { GUIDANCE_SECTION_NAME, UNIFIED_MEMORY_GUIDANCE_TEXT } from './guidance.js';
