export const prerender = true;

const wpDomain = 'https://cms.casinous.com';
const astroDomain = 'https://www.casinous.com';

// Sitemaps that have no matching front-end routes (they would be all 404s)
const EXCLUDED = ['author-sitemap'];

// Shared helper: fetch a WP sitemap by name and clean it up
async function fetchAndClean(name) {
    // Never serve excluded sitemaps
    if (EXCLUDED.includes(name)) {
        return null;
    }

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

    // FIX 2b: Remove the "." category base (https://www.casinous.com/./blog/ -> https://www.casinous.com/blog/)
    xmlString = xmlString.replace(/(https?:\/\/[^/<]+)\/\.\//g, '$1/');

    // FIX 2c: Also strip a real /category/ base, in case you clear the WP field later
    xmlString = xmlString.replace(/(https?:\/\/[^/<]+)\/category\//g, '$1/');

    // FIX 3: Remove all <image:image> tags
    xmlString = xmlString.replace(/<image:image>[\s\S]*?<\/image:image>/gi, '');

    // FIX 4: Remove excluded sub-sitemaps from the sitemap index
    for (const excluded of EXCLUDED) {
        const pattern = new RegExp(
            `<sitemap>\\s*<loc>[^<]*\\/${excluded}\\.xml<\\/loc>[\\s\\S]*?<\\/sitemap>`,
            'gi'
        );
        xmlString = xmlString.replace(pattern, '');
    }

    // FIX 5: Safety net - drop any <url> block pointing at /author/
    xmlString = xmlString.replace(
        /<url>\s*<loc>[^<]*\/author\/[^<]*<\/loc>[\s\S]*?<\/url>/gi,
        ''
    );

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
                if (EXCLUDED.includes(name)) continue; // skip author-sitemap etc.
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