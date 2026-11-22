/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@civictrack/contracts", "olamaps-web-sdk", "maplibre-gl"],
  async rewrites() {
    const apiBaseUrl = process.env.INTERNAL_API_URL || "http://127.0.0.1:4000";
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
