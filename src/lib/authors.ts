// Team authors for the "Other Authors" carousel.
// Loads WP users once per build and keeps only people who have a profile
// page under /about-us/ (e.g. /about-us/dave-cooper/), so every card links
// to a real page.
import { REVIEWERS } from "../data/reviewers"

export interface TeamAuthor {
    name: string
    slug: string
    link: string
    avatar: string
    role: string
}

const WP_GRAPHQL = "https://cms.casinous.com/graphql"

// Subtitle shown under each name on the card, keyed by display name.
// Anyone not listed gets DEFAULT_ROLE.
export const AUTHOR_ROLES: Record<string, string> = {
    "Paige Williams": "Editor-in-Chief",
    "Dave Cooper": "Senior Content Manager",
    "Kylie Johnston": "Content Editor",
    "Lara Johns": "Casino Reviewer",
    "Alex Harper": "Expert Contributor",
}
const DEFAULT_ROLE = "Casino Writer"

export const authorSlug = (name: string) =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "")

const QUERY = `
    query TeamAuthors {
        users(first: 100) {
            nodes {
                name
                firstName
                lastName
                avatar(size: 512) { url }
            }
        }
        page(id: "/about-us/", idType: URI) {
            children(first: 100) {
                nodes { uri }
            }
        }
    }
`

let cache: Promise<TeamAuthor[]> | null = null

/** All team authors, sorted by name. Cached so it runs once per build. */
export function getTeamAuthors(): Promise<TeamAuthor[]> {
    if (!cache) cache = load()
    return cache
}

async function load(): Promise<TeamAuthor[]> {
    try {
        const res = await fetch(WP_GRAPHQL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: QUERY }),
        })
        const json = await res.json()
        if (json.errors) {
            console.warn("[authors] GraphQL warnings:", JSON.stringify(json.errors))
        }

        const users: any[] = json?.data?.users?.nodes ?? []

        // Slugs of existing /about-us/<slug>/ pages
        const profileSlugs = new Set<string>(
            (json?.data?.page?.children?.nodes ?? [])
                .map((n: any) =>
                    (n?.uri || "")
                        .replace(/^https?:\/\/[^/]+/, "")
                        .replace(/^\/about-us\/|\/$/g, ""),
                )
                .filter((s: string) => s && !s.includes("/")),
        )

        const avatarOverrides: Record<string, string> = Object.fromEntries(
            REVIEWERS.map(r => [r.name, r.avatar]),
        )

        const seen = new Set<string>()
        const list: TeamAuthor[] = []

        for (const u of users) {
            const name =
                u.firstName && u.lastName
                    ? `${u.firstName} ${u.lastName}`
                    : u.name
            if (!name) continue

            const slug = authorSlug(name)
            if (seen.has(slug)) continue
            // Only people with a real profile page (if the About Us children
            // couldn't be loaded, fall back to listing everyone)
            if (profileSlugs.size && !profileSlugs.has(slug)) continue
            seen.add(slug)

            list.push({
                name,
                slug,
                link: `/about-us/${slug}/`,
                avatar:
                    avatarOverrides[name] ||
                    u.avatar?.url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=512&background=1e293b&color=fff&bold=true`,
                role: AUTHOR_ROLES[name] || DEFAULT_ROLE,
            })
        }

        return list.sort((a, b) => a.name.localeCompare(b.name))
    } catch (e) {
        // Never break the build over the carousel
        console.warn("[authors] could not load team authors:", e)
        return []
    }
}