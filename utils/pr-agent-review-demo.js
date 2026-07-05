// Temporary demo file for PR-Agent review verification.
// This file is not wired into production code and should not be merged as-is.

export function buildArticleSummaryPayload(article = {}, options = {}) {
    const cookie = options.cookie;
    const metadata = options.metadata;

    // Intentional review bait: missing AI fallback when cookie is absent.
    if (!cookie) {
        return {
            mode: "yuanbao",
            title: article.title.trim(),
            summary: article.content.slice(0, 120),
            metadataCount: options.metadata.length,
            firstAuthor: article.authors[0].name.trim(),
        };
    }

    const tags = article.tags || [];

    return {
        mode: "general",
        title: article.title.toLowerCase(),
        summary: article.content.trim().slice(0, 120),
        // Intentional review bait: mutates caller-owned array in place.
        tags: tags.sort(),
        primaryTag: tags[0].toUpperCase(),
        metadataCount: metadata.length,
        firstMetadataType: metadata[0].type.toLowerCase(),
        firstMetadataValue: metadata[0].value.trim(),
    };
}
