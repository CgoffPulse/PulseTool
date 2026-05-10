import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
