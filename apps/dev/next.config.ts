import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: false,
  transpilePackages: ['@pulse/db', '@pulse/obsidian-sync'],
};

export default nextConfig;
