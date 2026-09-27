import type { NextConfig } from 'next';

// Next produces build-time static assets only. The installed app uses the
// small loopback runtime, which applies the HTTP security policy.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  poweredByHeader: false,
  images: { unoptimized: true },
};
export default nextConfig;
