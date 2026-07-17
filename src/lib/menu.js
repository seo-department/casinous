// ---- Config -----------------------------------------------------------
const WP_GRAPHQL_URL =
    import.meta.env.WP_GRAPHQL_URL ||
    "https://wordpress-1621926-6409582.cloudwaysapps.com/graphql"
const MENU_LOCATION = "PRIMARY"
const DEFAULT_ICON_COLOR = "#cbd5e1"

// ---- Balancing config ---------------------------------------------------
const MAX_PER_COLUMN = 8
const MAX_COLUMNS = 4

// ---- Fetch --------------------------------------------------------------
async function fetchMenuItems() {
    const query = `
    query GetHeaderMenu {
      menuItems(where: { location: ${MENU_LOCATION} }, first: 100) {
        nodes {
          id
          label
          url
          parentId
          cssClasses
          description
        }
      }
    }
  `

    try {
        const res = await fetch(WP_GRAPHQL_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
        })

        if (!res.ok) {
            console.error(`WP menu fetch failed: ${res.status} ${res.statusText}`)
            return []
        }

        const json = await res.json()

        if (json.errors) {
            console.error("WPGraphQL menu errors:", json.errors)
            return []
        }

        return json?.data?.menuItems?.nodes ?? []
    } catch (err) {
        console.error("Failed to fetch WP nav menu:", err)
        return []
    }
}

// ---- Metadata parsing -----------------------------------------------------
function parseMeta(description) {
    if (!description) {
        return { icon: null, color: DEFAULT_ICON_COLOR, column: null }
    }
    try {
        const parsed = JSON.parse(description)
        return {
            icon: parsed.icon ?? null,
            color: parsed.color ?? DEFAULT_ICON_COLOR,
            column: parsed.column ?? null,
        }
    } catch {
        return { icon: null, color: DEFAULT_ICON_COLOR, column: null }
    }
}

// ---- Build tree ------------------------------------------------------------
function buildMenuTree(rawItems) {
    const byParent = new Map()
    rawItems.forEach(item => {
        const key = item.parentId ?? null
        if (!byParent.has(key)) byParent.set(key, [])
        byParent.get(key).push(item)
    })

    function toNode(item) {
        const meta = parseMeta(item.description)
        const classes = item.cssClasses ?? []
        const children = (byParent.get(item.id) ?? []).map(toNode)

        return {
            id: item.id,
            label: item.label,
            url: item.url,
            icon: meta.icon,
            color: meta.color,
            column: meta.column,
            isMega: classes.includes("mega-menu"),
            isViewAll: classes.includes("view-all"),
            children,
        }
    }

    return (byParent.get(null) ?? []).map(toNode)
}

// ---- Weight-balanced column builder (accounts for grandchildren height) ---
function itemWeight(item) {
    return 1 + (item.children?.length || 0)
}

function buildColumns(children) {
    const hasExplicitColumns = children.some(c => c.column != null)
    const totalWeight = children.reduce((sum, c) => sum + itemWeight(c), 0)

    // Always respect explicit WP column assignments, regardless of list length —
    // an editor manually splitting items into columns in WP admin should never
    // be silently overridden by the auto-balancer just because the list is long
    if (hasExplicitColumns) {
        const columns = []
        const index = new Map()

        children.forEach(child => {
            const key = child.column ?? 1 // items missing a column fall into column 1
            if (!index.has(key)) {
                index.set(key, columns.length)
                columns.push({ title: key, items: [] })
            }
            columns[index.get(key)].items.push(child)
        })

        // Keep columns in numeric order (1, 2, 3...) rather than first-seen order
        columns.sort((a, b) => (a.title ?? 0) - (b.title ?? 0))

        return columns
    }

    // Auto-balance by weight only when WP hasn't specified columns manually
    if (totalWeight > MAX_PER_COLUMN) {
        const numColumns = Math.min(MAX_COLUMNS, Math.ceil(totalWeight / MAX_PER_COLUMN))
        const buckets = Array.from({ length: numColumns }, () => [])
        const weights = new Array(numColumns).fill(0)

        // Heaviest items first so the greedy fill doesn't lock in an uneven split
        const sorted = [...children].sort((a, b) => itemWeight(b) - itemWeight(a))

        for (const child of sorted) {
            const lightest = weights.indexOf(Math.min(...weights))
            buckets[lightest].push(child)
            weights[lightest] += itemWeight(child)
        }

        // Restore original menu order within each column
        for (const bucket of buckets) {
            bucket.sort((a, b) => children.indexOf(a) - children.indexOf(b))
        }

        return buckets.filter(b => b.length > 0).map(items => ({ title: null, items }))
    }

    // Short list — no split needed
    return [{ title: null, items: children }]
}

// ---- Public API -------------------------------------------------------------
export async function getPrimaryMenu() {
    const rawMenu = await fetchMenuItems()
    return buildMenuTree(rawMenu)
}

export { buildColumns }