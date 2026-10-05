// 🚨 SINGLE SOURCE OF TRUTH FOR FACT-CHECKERS (used by every page)
// Add/remove people here and every page picks it up on the next build.

export interface Reviewer {
    name: string
    avatar: string
    link: string
    role: string
}

// `link` is set explicitly so the profile URL never depends on how the
// display name happens to be spelled.
const makeReviewer = (
    name: string,
    link: string,
    avatar: string,
): Reviewer => ({
    name,
    avatar,
    link,
    role: "Casino Expert",
})

export const REVIEWERS: Reviewer[] = [
    makeReviewer(
        "Dave Cooper",
        "/about-us/dave-cooper/",
        "https://secure.gravatar.com/avatar/907015fdee956f1b4291ed4c4290571d3b2652adbe40b1938629a7d9b65a8f08?s=150&d=mm&r=g",
    ),
    makeReviewer(
        "Paige Williams",
        "/about-us/paige-williams/",
        "https://secure.gravatar.com/avatar/b5b0117907d6dc14bd89e93752ab00d26bb4608b5f3d0f4bff4d5545071120d3?s=150&d=mm&r=g",
    ),
]

// Small stable string hash (djb2) so the same page always gets the same
// reviewer between builds, and pages split roughly 50/50 between them.
const hashString = (value: string) => {
    let hash = 5381
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0
    }
    return Math.abs(hash)
}

/**
 * Pick the fact-checker for a page.
 * @param pageKey    the page's URI (e.g. "/online-casinos/" or post.uri)
 * @param authorName the page's author, so nobody fact-checks their own page
 */
export function getReviewer(pageKey: string, authorName?: string): Reviewer {
    const author = (authorName || "").trim().toLowerCase()
    const pool = REVIEWERS.filter(r => r.name.toLowerCase() !== author)
    const candidates = pool.length > 0 ? pool : REVIEWERS

    const normalizedKey = (pageKey || "/")
        .replace(/https?:\/\/[^\/]+/gi, "")
        .replace(/^\/+|\/+$/g, "")
        .toLowerCase()

    return candidates[hashString(normalizedKey) % candidates.length]
}