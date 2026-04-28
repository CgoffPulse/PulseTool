/**
 * Markdown sync hook — v1 is a no-op so writes don't fail. v2 will swap in an
 * ObsidianVaultSync writing to `~/ObsidianVault/Pulse/{Projects,Tasks}/…`.
 *
 * Server Actions call `markdownSync.upsert(...)` after each mutation; no app
 * code changes when v2 lands.
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

export const markdownSync: MarkdownSync = {
  async upsert() {
    /* no-op until v2 */
  },
  async delete() {
    /* no-op until v2 */
  },
};
