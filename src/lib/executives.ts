const WP_DOMAIN = "https://cms.casinous.com"
const WP_GRAPHQL = `${WP_DOMAIN}/graphql`

export const EXECUTIVES_PARENT_URI = "/profiles/"
export const EXECUTIVES_PER_PAGE = 32

export type Executive = {
    name: string
    company: string
    role: string
    link: string
    image: string
    imageAlt: string
}

export type ExecutivesData = {
    parent: {
        title: string
        seoTitle: string
        metaDesc: string
        introHtml: string
    }
    executives: Executive[]
}

async function gql(query: string, variables: Record<string, unknown> = {}) {
    const res = await fetch(WP_GRAPHQL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
    })
    const json = await res.json()
    if (json.errors) {
        console.error("❌ EXECUTIVES GRAPHQL ERROR:", JSON.stringify(json.errors, null, 2))
        throw new Error("WordPress rejected the executives query.")
    }
    return json.data
}

const decode = (s: string) =>
    (s || "")
        .replace(/&amp;/g, "&")
        .replace(/&#0?38;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;|&#8217;|&rsquo;/g, "’")
        .replace(/&#8211;|&ndash;/g, "–")
        .replace(/&#8212;|&mdash;/g, "—")
        .replace(/&nbsp;/g, " ")

const toRelative = (url: string) => {
    if (!url) return ""
    try {
        return new URL(url).pathname
    } catch {
        return url
    }
}

async function load(): Promise<ExecutivesData> {
    const year = new Date().getFullYear().toString()

    // 1. The parent page (SEO + intro + its database ID)
    const parentData = await gql(
        `query ExecParent($uri: ID!) {
            page(id: $uri, idType: URI) {
                databaseId title content
                seo { title metaDesc }
            }
        }`,
        { uri: EXECUTIVES_PARENT_URI },
    )

    const parentNode = parentData?.page
    if (!parentNode) {
        console.warn("[executives] No /executives/ page found in WordPress.")
        return {
            parent: { title: "Executives", seoTitle: "Executives", metaDesc: "", introHtml: "" },
            executives: [],
        }
    }

    // 2. All published children, ordered by Page Order, then title
    const executives: Executive[] = []
    let after: string | null = null
    let hasNext = true

    while (hasNext) {
        const data = await gql(
            `query ExecChildren($parent: ID, $after: String) {
                pages(
                    first: 100
                    after: $after
                    where: {
                        parent: $parent
                        orderby: [
                            { field: MENU_ORDER, order: ASC }
                            { field: TITLE, order: ASC }
                        ]
                    }
                ) {
                    pageInfo { hasNextPage endCursor }
                    nodes {
                        title uri cusExecCompany cusExecRole
                        featuredImage { node { sourceUrl(size: MEDIUM) altText } }
                    }
                }
            }`,
            { parent: String(parentNode.databaseId), after },
        )

        for (const n of data.pages.nodes) {
            const name = decode(n.title)
            const rel = (n.uri || "").replace(/https?:\/\/[^/]+/i, "")
            executives.push({
                name,
                company: decode(n.cusExecCompany || ""),
                role: decode(n.cusExecRole || ""),
                link: `/${rel.replace(/^\/|\/$/g, "")}/`,
                image: toRelative(n.featuredImage?.node?.sourceUrl || ""),
                imageAlt: n.featuredImage?.node?.altText || name,
            })
        }

        hasNext = data.pages.pageInfo.hasNextPage
        after = data.pages.pageInfo.endCursor
    }

    return {
        parent: {
            title: decode(parentNode.title || "Executives").replaceAll("[year]", year),
            seoTitle: decode(parentNode.seo?.title || parentNode.title || "Executives").replaceAll("[year]", year),
            metaDesc: decode(parentNode.seo?.metaDesc || "").replaceAll("[year]", year),
            introHtml: (parentNode.content || "").replaceAll(WP_DOMAIN, "").replaceAll("[year]", year),
        },
        executives,
    }
}

// One fetch per build, shared by both executives routes
let cache: Promise<ExecutivesData> | null = null
export function getExecutivesData() {
    if (!cache) cache = load()
    return cache
}

export const executivesPageUrl = (n: number) =>
    n <= 1 ? "/profiles/" : `/profiles/page/${n}/`

// 1 2 … 10  /  1 … 4 5 6 … 10
export function paginationItems(current: number, total: number): (number | "gap")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    const pages = [...new Set([1, total, current - 1, current, current + 1])]
        .filter(p => p >= 1 && p <= total)
        .sort((a, b) => a - b)
    const out: (number | "gap")[] = []
    let prev = 0
    for (const p of pages) {
        if (p - prev === 2) out.push(prev + 1)
        else if (p - prev > 2) out.push("gap")
        out.push(p)
        prev = p
    }
    return out
}