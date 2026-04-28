import { NoopMarkdownSync, type MarkdownSync } from '@pulse/obsidian-sync';

/**
 * The dev hub's markdown sync hook. v1 is a no-op. v2 will swap in
 * `ObsidianVaultSync` from `@pulse/obsidian-sync`. Server Actions call
 * `markdownSync.upsert(...)` after each mutation; no app code changes
 * when v2 lands.
 */
export const markdownSync: MarkdownSync = NoopMarkdownSync;
