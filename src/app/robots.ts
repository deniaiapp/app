import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/ads.txt"],
        disallow: ["/chat", "/settings", "/api", "/auth", "/account", "/getting-started"],
      },
    ],
    sitemap: "https://deniai.app/sitemap.xml",
  };
}
