export const prerender = false;
import { createClient } from 'redis';

export async function POST({ request }) {
    try {
        const body = await request.json();
        const { casinoId, type } = body; 

        if (!casinoId || !['up', 'down'].includes(type)) {
            return new Response(JSON.stringify({ error: 'Invalid vote data' }), { status: 400 });
        }

        const redisUrl = import.meta.env.REDIS_URL || process.env.REDIS_URL;
        
        // Initialize the SDK
        const client = createClient({ url: redisUrl });
        await client.connect();

        // Add 1 to the vote count
        const newCount = await client.incr(`casino_${casinoId}_${type}`);

        await client.disconnect();

        return new Response(JSON.stringify({ success: true, newCount }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Redis Error:", error);
        return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
    }
}