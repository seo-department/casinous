export const prerender = true;

const wpDomain = 'https://wordpress-1621926-6409582.cloudwaysapps.com';
const astroDomain = 'https://www.casinous.com';

// Shared helper: fetch a WP sitemap by name and clean it up
async function fetchAndClean(name) {
    const wpSitemapUrl = `${wpDomain}/${name}.xml`;
    const response = await fetch(wpSitemapUrl);

    if (!response.ok) {
        return null;
    }

    let xmlString = await response.text();

    // FIX 1: Destroy the Yoast Stylesheet
    xmlString = xmlString.replace(/<\?xml-stylesheet[^>]*\?>/i, '');

    // FIX 2: Rewrite all backend URLs to your Astro frontend URLs
    xmlString = xmlString.replaceAll(wpDomain, astroDomain);

    // FIX 3: Remove all <image:image> tags
    xmlString = xmlString.replace(/<image:image>[\s\S]*?<\/image:image>/gi, '');

    return xmlString;
}

// Build time: discover every sub-sitemap from the Yoast index
export async function getStaticPaths() {
    const paths = [{ params: { sitemap: 'sitemap' } }]; // the index, served at /sitemap.xml

    try {
        const response = await fetch(`${wpDomain}/sitemap_index.xml`);
        if (response.ok) {
            const xml = await response.text();
            const names = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
                .map(m =>
                    m[1]
                        .replace(wpDomain, '')
                        .replace(/^\//, '')
                        .replace(/\.xml$/, '')
                )
                .filter(Boolean);

            for (const name of names) {
                paths.push({ params: { sitemap: name } });
            }
        }
    } catch (error) {
        // If WP is unreachable at build time, we still emit /sitemap.xml
        console.error('Could not fetch sitemap index:', error);
    }

    return paths;
}

export async function GET({ params }) {
    let { sitemap } = params;

    // If the user asks for /sitemap.xml, fetch the Yoast index behind the scenes
    if (sitemap === 'sitemap') {
        sitemap = 'sitemap_index';
    }

    try {
        const xmlString = await fetchAndClean(sitemap);

        if (xmlString === null) {
            return new Response('Sitemap not found', { status: 404 });
        }

        return new Response(xmlString, {
            status: 200,
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (error) {
        return new Response('Error fetching sitemap', { status: 500 });
    }
}