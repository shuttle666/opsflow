import type { MetadataRoute } from "next";

const siteUrl = "https://opsflow.aboutwenduo.wang";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
