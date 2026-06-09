import { writeFileSync } from 'node:fs';

const endpoint = 'https://wordpress-1621926-6409582.cloudwaysapps.com/wp-json/cvc/v1/redirects';

const base = {
  rewrites: [
    {
      source: '/wp-content/:path*',
      destination: 'https://wordpress-1621926-6409582.cloudwaysapps.com/wp-content/:path*',
    },
  ],
};

try {
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`WP responded ${res.status}`);
  const list = await res.json();

  base.redirects = list
    .filter((r) => r && r.source && r.destination)
    .map((r) => ({
      source: r.source,
      destination: r.destination,
      permanent: !!r.permanent,
    }));

  console.log(`[redirects] Wrote ${base.redirects.length} redirects to vercel.json`);
} catch (err) {
  console.warn(`[redirects] Fetch failed (${err.message}). Writing vercel.json with no redirects.`);
  base.redirects = [];
}

writeFileSync('vercel.json', JSON.stringify(base, null, 2));