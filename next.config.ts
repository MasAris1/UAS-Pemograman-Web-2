import type { NextConfig } from "next";

const remotePatterns: NonNullable<NextConfig['images']>['remotePatterns'] = [
  {
    protocol: 'https',
    hostname: 'images.unsplash.com',
  },
]

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)

  remotePatterns.push({
    protocol: supabaseUrl.protocol.replace(':', '') as 'http' | 'https',
    hostname: supabaseUrl.hostname,
  })
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
};

export default nextConfig;
