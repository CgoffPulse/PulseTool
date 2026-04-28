import type { Asset, Shoot } from '../types';
import type { AssetProvider, AssetRef } from './provider';

/**
 * v1 Drive provider: link-tracking only, no Drive API calls.
 *
 * Each shoot has a `drive_folder_url`; captured items are recorded as `assets`
 * rows pointing to a shareable Drive URL. When you adopt the DAM, swap this
 * file for a `DamApiProvider` implementing the same interface.
 */
export class GoogleDriveLinkProvider implements AssetProvider {
  readonly kind = 'drive' as const;

  shootFolderUrl(shoot: Shoot): string | null {
    return shoot.drive_folder_url;
  }

  async listAssets(_shoot: Shoot): Promise<AssetRef[]> {
    // No enumeration without API credentials — UI reads from DB.
    return [];
  }

  resolveUrl(asset: Asset): string | null {
    if (asset.provider !== 'drive') return null;
    return asset.provider_ref || null;
  }
}

export const drive = new GoogleDriveLinkProvider();
