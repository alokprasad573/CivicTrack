import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/map"],
        disallow: [
          "/admin",
          "/officer",
          "/citizen",
          "/notifications",
          "/sign-in",
          "/sign-up",
          "/api",
        ],
      },
    ],
    sitemap: "/sitemap.xml",
  };
}