import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Locally we live inside a pnpm monorepo and Turbopack must reach into the
// `.pnpm` symlink store above this directory to resolve `next` and friends.
// On Vercel only this directory is uploaded (rootDirectory=apps/crm) so the
// inferred root is correct and we should NOT override it.
const here = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(here, '..', '..');
const onVercel = !!process.env.VERCEL;

const nextConfig: NextConfig = {
  typedRoutes: false,
  ...(onVercel
    ? {}
    : {
        outputFileTracingRoot: monorepoRoot,
        turbopack: { root: monorepoRoot },
      }),
};

export default nextConfig;
