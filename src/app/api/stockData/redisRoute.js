// nextjs-frontend/pages/api/stockData.js or app/api/stockData/route.js
import Redis from 'ioredis';
import dbConnect from '@/lib/db';

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Store active connections
const activeConnections = new Set();

export async function GET() {
    await dbConnect();

    const encoder = new TextEncoder();
    let isStreamClosed = false;
    let subscriber = null;

    const customReadable = new ReadableStream({
        start(controller) {
            // Create Redis subscriber
            subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

            // Track this connection
            activeConnections.add(controller);

            // Send initial data if available
            const sendInitialData = async () => {
                try {
                    const latestData = await redis.get('latest-stock-data');
                    if (latestData && !isStreamClosed) {
                        const data = JSON.parse(latestData);
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data.updates)}\n\n`));
                    }
                } catch (error) {
                    console.error('Error sending initial data:', error);
                }
            };

            // Send initial data
            sendInitialData();

            // Subscribe to stock updates
            subscriber.subscribe('stock-updates', (err, count) => {
                if (err) {
                    console.error('Redis subscription error:', err);
                    return;
                }
                console.log(`Subscribed to ${count} channel(s)`);
            });

            // Handle incoming messages
            subscriber.on('message', (channel, message) => {
                try {
                    if (channel === 'stock-updates' && !isStreamClosed) {
                        const data = JSON.parse(message);
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data.updates)}\n\n`));
                    }
                } catch (error) {
                    if (error.code !== 'ERR_INVALID_STATE') {
                        console.error('Error sending SSE data:', error);
                    }
                }
            });

            // Handle Redis connection errors
            subscriber.on('error', (err) => {
                console.error('Redis subscriber error:', err);
            });

            // Cleanup function
            return () => {
                isStreamClosed = true;
                activeConnections.delete(controller);
                if (subscriber) {
                    subscriber.unsubscribe();
                    subscriber.disconnect();
                }
            };
        },
        cancel() {
            isStreamClosed = true;
            activeConnections.delete(this);
            if (subscriber) {
                subscriber.unsubscribe();
                subscriber.disconnect();
            }
        }
    });

    return new Response(customReadable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
        },
    });
}

// Optional: Endpoint to manually trigger market worker (if needed)
export async function POST() {
    try {
        const marketWorkerUrl = process.env.MARKET_WORKER_URL || 'http://localhost:3001';

        const response = await fetch(`${marketWorkerUrl}/trigger-cycle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const result = await response.json();

        return new Response(JSON.stringify({
            success: true,
            message: 'Market worker triggered successfully',
            data: result
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error triggering market worker:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}