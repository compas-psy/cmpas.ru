import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/psidairy',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
