export const prerender = false;
import { createClient } from 'redis';

export async function GET({ request }) {
    const url = new URL(request.url);
    const casinoId = url.searchParams.get('id');

    if (!casinoId) {
        return new Response(JSON.stringify({ error: 'No ID provided' }), { status: 400 });
    }

    // Grab the URL from your newly updated .env file
    const redisUrl = import.meta.env.REDIS_URL || process.env.REDIS_URL;

    if (!redisUrl) {
        console.error("REDIS_URL is missing!");
        return new Response(JSON.stringify({ error: 'Database missing' }), { status: 500 });
    }

    // Initialize the SDK (Just like Step 4 in your screenshot!)
    const client = createClient({ url: redisUrl });

    try {
        await client.connect();
        
        const upVotesStr = await client.get(`casino_${casinoId}_up`);
        const downVotesStr = await client.get(`casino_${casinoId}_down`);

        const upVotes = parseInt(upVotesStr) || 0;
        const downVotes = parseInt(downVotesStr) || 0;

        await client.disconnect();

        return new Response(JSON.stringify({ upVotes, downVotes }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Redis Error:", error);
        return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
    }
}