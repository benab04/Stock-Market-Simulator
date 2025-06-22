// nextjs-frontend/pages/api/stockData.js or app/api/stockData/route.js
import { Redis } from '@upstash/redis';
import dbConnect from '@/lib/db';

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

// Upstash Redis HTTP client
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
    retry: {
        retries: 3,
        retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 5000)
    }
});

// Store active connections for cleanup
const activeConnections = new Set();

// Polling interval for simulating real-time updates (since Upstash HTTP doesn't support traditional pub/sub)
const POLLING_INTERVAL = 2000; // 2 seconds

export async function GET() {
    await dbConnect();

    const encoder = new TextEncoder();
    let isStreamClosed = false;
    let pollingTimer = null;
    let lastUpdateTimestamp = 0;

    const customReadable = new ReadableStream({
        start(controller) {
            // Track this connection
            activeConnections.add(controller);

            // Send initial data
            const sendInitialData = async () => {
                try {
                    const latestData = await redis.get('latest-stock-data');
                    if (latestData && !isStreamClosed) {
                        const data = typeof latestData === 'string' ? JSON.parse(latestData) : latestData;
                        lastUpdateTimestamp = data.timestamp || 0;

                        // Send the stock updates in the same format as before
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data.updates || [])}\n\n`));
                        console.log(`SSE: Sent initial data with ${data.updates?.length || 0} stocks`);
                    }
                } catch (error) {
                    console.error('Error sending initial data:', error);
                }
            };

            // Send initial data immediately
            sendInitialData();

            // Set up polling to check for updates (simulating pub/sub)
            const pollForUpdates = async () => {
                try {
                    if (isStreamClosed) return;

                    // Check for new data by comparing timestamps
                    const latestData = await redis.get('latest-stock-data');
                    if (latestData) {
                        const data = typeof latestData === 'string' ? JSON.parse(latestData) : latestData;

                        // Only send if we have newer data
                        if (data.timestamp && data.timestamp > lastUpdateTimestamp) {
                            lastUpdateTimestamp = data.timestamp;

                            if (!isStreamClosed) {
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data.updates || [])}\n\n`));
                                console.log(`SSE: Sent updated data with ${data.updates?.length || 0} stocks`);
                            }
                        }
                    }

                    // Alternative: Check the updates feed for new items
                    const feedUpdates = await redis.lrange('stock-updates-feed', 0, 0); // Get latest item
                    if (feedUpdates && feedUpdates.length > 0) {
                        try {
                            const latestFeedItem = typeof feedUpdates[0] === 'string' ?
                                JSON.parse(feedUpdates[0]) : feedUpdates[0];

                            // Send feed update if it's newer than our last update
                            if (latestFeedItem.timestamp && latestFeedItem.timestamp > lastUpdateTimestamp) {
                                lastUpdateTimestamp = latestFeedItem.timestamp;

                                if (!isStreamClosed) {
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(latestFeedItem.updates || [])}\n\n`));
                                    console.log(`SSE: Sent feed update with ${latestFeedItem.updates?.length || 0} stocks`);
                                }
                            }
                        } catch (parseError) {
                            console.error('Error parsing feed item:', parseError);
                        }
                    }

                } catch (error) {
                    if (!isStreamClosed) {
                        console.error('Error polling for updates:', error);
                    }
                }

                // Schedule next poll
                if (!isStreamClosed) {
                    pollingTimer = setTimeout(pollForUpdates, POLLING_INTERVAL);
                }
            };

            // Start polling after initial data is sent
            setTimeout(pollForUpdates, POLLING_INTERVAL);

            // Cleanup function
            return () => {
                isStreamClosed = true;
                activeConnections.delete(controller);
                if (pollingTimer) {
                    clearTimeout(pollingTimer);
                    pollingTimer = null;
                }
            };
        },
        cancel() {
            isStreamClosed = true;
            activeConnections.delete(this);
            if (pollingTimer) {
                clearTimeout(pollingTimer);
                pollingTimer = null;
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

// Optional: Endpoint to manually trigger market worker (unchanged functionality)
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

// Additional helper endpoints for direct data access

// Get latest stock data directly (non-streaming)
export async function getLatestStockData() {
    try {
        const data = await redis.get('latest-stock-data');
        if (data) {
            return typeof data === 'string' ? JSON.parse(data) : data;
        }
        return null;
    } catch (error) {
        console.error('Error fetching latest stock data:', error);
        return null;
    }
}

// Get specific stock data
export async function getStockData(symbol) {
    try {
        const data = await redis.get(`stock:${symbol.toUpperCase()}`);
        if (data) {
            return typeof data === 'string' ? JSON.parse(data) : data;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching stock data for ${symbol}:`, error);
        return null;
    }
}

// Get stock updates feed
export async function getStockUpdatesFeed(limit = 10) {
    try {
        const feed = await redis.lrange('stock-updates-feed', 0, Math.min(limit - 1, 49));

        const updates = feed.map(item => {
            try {
                return typeof item === 'string' ? JSON.parse(item) : item;
            } catch (e) {
                return null;
            }
        }).filter(Boolean);

        return { updates, count: updates.length };
    } catch (error) {
        console.error('Error fetching stock feed:', error);
        return { updates: [], count: 0 };
    }
}

// Graceful cleanup on process termination
const cleanup = () => {
    console.log('Cleaning up active SSE connections...');
    activeConnections.forEach(controller => {
        try {
            controller.close();
        } catch (error) {
            // Ignore errors during cleanup
        }
    });
    activeConnections.clear();
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('beforeExit', cleanup);