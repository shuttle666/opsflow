import type { MetadataRoute } from "next";

const siteUrl = "https://opsflow.aboutwenduo.wang";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/customers",
        "/jobs",
        "/schedule",
        "/team",
        "/agent",
        "/activity",
        "/login",
        "/register",
        "/invitations",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
