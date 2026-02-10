import type { MetadataRoute } from "next";

function getBaseUrl(): string {
    const envUrl ="https://umariai.uz";

    return envUrl.replace(/\/+$/, "");
}

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = getBaseUrl();
    const now = new Date();

    return [
        {
            url: `${baseUrl}/`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 1,
        }
    ];
}