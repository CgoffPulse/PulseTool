import type { Asset, AssetProviderKind, Shoot } from '../types';

export interface AssetRef {
  provider: AssetProviderKind;
  provider_ref: string;
  label?: string;
  thumbnail_path?: string | null;
}

export interface AssetProvider {
  readonly kind: AssetProviderKind;

  /** Where do raw captured assets for this shoot live? */
  shootFolderUrl(shoot: Shoot): string | null;

  /**
   * List captured assets for a shoot. Implementations that don't enumerate
   * (e.g. Drive without API credentials) return an empty array; the UI then
   * falls back to manually-recorded `assets` rows in the database.
   */
  listAssets(shoot: Shoot): Promise<AssetRef[]>;

  /**
   * Build a display URL for an asset row, used to render preview thumbnails
   * and "open in Drive/DAM" links.
   */
  resolveUrl(asset: Asset): string | null;
}
