import type { NextConfig } from "next";

const noindexRoutes = [
  "/dashboard/:path*",
  "/customers/:path*",
  "/jobs/:path*",
  "/schedule/:path*",
  "/team/:path*",
  "/agent/:path*",
  "/activity/:path*",
  "/login",
  "/register",
  "/invitations/:path*",
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output:
    process.env.PLAYWRIGHT_START_SERVERS === "true"
      ? undefined
      : "standalone",
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async headers() {
    return noindexRoutes.map((source) => ({
      source,
      headers: [
        {
          key: "X-Robots-Tag",
          value: "noindex, nofollow",
        },
      ],
    }));
  },
};

export default nextConfig;
