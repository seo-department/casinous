const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")

// WordPress usernames / short display names -> real /about-us/<slug>/ pages
const ALIASES: Record<string, string> = {
    paige: "paige-williams",
    alex: "alex-harper",
    kylie: "kylie-johnston",
    david: "dave-cooper",
    dave: "dave-cooper",
}

export const authorSlugFromName = (name?: string) => {
    const slug = slugify(name || "")
    if (!slug) return "editorial-team"
    return ALIASES[slug] ?? slug
}

// Same display-name rule used everywhere else (first + last, else name)
export const getAuthorName = (node?: any) =>
    !node
        ? "Editorial Team"
        : node.firstName && node.lastName
          ? `${node.firstName} ${node.lastName}`
          : node.name || "Editorial Team"