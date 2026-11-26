/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@civictrack/contracts", "olamaps-web-sdk", "maplibre-gl"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com; connect-src 'self' https: wss: https://*.clerk.accounts.dev https://*.clerk.com; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
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
