/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@civictrack/contracts", "olamaps-web-sdk", "maplibre-gl"],
  async rewrites() {
    const rawUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
    // Strip trailing slashes and redundant /api/v1 prefix to prevent malformed destination paths
    const apiBaseUrl = rawUrl.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiBaseUrl}/api/v1/:path*`,
      },
      {
        source: "/docs/:path*",
        destination: `${apiBaseUrl}/docs/:path*`,
      },
    ];
  },
};

export default nextConfig;
