/**
 * Pluggable markdown sync for the Pulse ecosystem.
 *
 * v1 ships a `NoopMarkdownSync` so app code can call `markdownSync.upsert(...)`
 * after each mutation harmlessly. v2 swaps in `ObsidianVaultSync` writing to
 * `~/ObsidianVault/Pulse/{Projects,Tasks,Posts}/{slug}.md`. App code does not
 * change.
 *
 * Mirrors the social tool's pluggable AssetProvider pattern.
 */

export interface MarkdownSync {
  upsert(
    entity: string,
    id: string,
    frontmatter: Record<string, unknown>,
    body: string
  ): Promise<void>;
  delete(entity: string, id: string): Promise<void>;
}

export const NoopMarkdownSync: MarkdownSync = {
  async upsert() {
    /* no-op until v2 */
  },
  async delete() {
    /* no-op until v2 */
  },
};
