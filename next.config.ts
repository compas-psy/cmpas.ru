import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
