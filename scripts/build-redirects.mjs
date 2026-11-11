import { writeFileSync } from 'node:fs';

const endpoint = 'https://cms.casinous.com/wp-json/cvc/v1/redirects';

const base = {
  rewrites: [
    {
      source: '/wp-content/:path*',
      destination: 'https://cms.casinous.com/wp-content/:path*',
    },
  ],
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        {
          key: 'Content-Security-Policy-Report-Only',
          value:
            "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'self'",
        },
      ],
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