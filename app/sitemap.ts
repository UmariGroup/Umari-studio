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
            url: `${baseUrl}/uz`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 1,
        },
        {
            url: `${baseUrl}/ru`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 1,
        }
    ];
}