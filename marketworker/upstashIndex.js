// market-worker-service/index.js
import express from 'express';
import { Redis } from '@upstash/redis';
import dbConnect from './lib/db.js';
import { updateAllStockPrices } from './lib/marketEngine.js';
import { updateCandlesticksBatch } from './lib/candlestickAggregator.js';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 3001;


// Upstash Redis HTTP client - much simpler and more reliable
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
    // Automatic retries with exponential backoff
    retry: {
        retries: 3,
        retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 10000)
    }
});

// Simple Redis health check
const checkRedisHealth = async () => {
    try {
        const result = await redis.ping();
        return result === 'PONG';
    } catch (error) {
        console.error('Redis health check failed:', error.message);
        return false;
    }
};

class OptimizedMarketWorker {
    constructor() {
        this.isRunning = false;
        this.lastUpdateTime = null;
        this.lastUpdateData = null;
        this.updateInterval = 30000; // 30 seconds
        this.intervalTimer = null;
        this.cycleTimeout = null;
        this.isCycleActive = false;
        this.continuousMode = process.env.CONTINUOUS_ENGINE === 'true';
        this.activeUpdates = new Set();
        this.maxConcurrentUpdates = 1;
        this.lastPublishTime = 0;
        this.publishThrottle = 2000; // 2 seconds for HTTP API
        this.redisHealthy = true;
    }

    getNextUTCAlignedTime() {
        const now = Date.now();
        const intervalMs = this.updateInterval;
        const secondsSinceEpoch = Math.floor(now / 1000);
        const intervalSeconds = intervalMs / 1000;
        const nextAlignedSeconds = Math.ceil(secondsSinceEpoch / intervalSeconds) * intervalSeconds;
        return nextAlignedSeconds * 1000;
    }

    getDelayToNextUTCInterval() {
        const now = Date.now();
        const nextAlignedTime = this.getNextUTCAlignedTime();
        return nextAlignedTime - now;
    }

    async checkRedisHealth() {
        try {
            this.redisHealthy = await checkRedisHealth();
            return this.redisHealthy;
        } catch (error) {
            this.redisHealthy = false;
            return false;
        }
    }

    async start() {
        if (this.isRunning) return;

        try {
            this.isRunning = true;
            await dbConnect();

            // Initial Redis health check
            console.log('Performing initial Redis health check...');
            await this.checkRedisHealth();

            if (this.continuousMode) {
                console.log('Starting market worker in continuous mode with UTC alignment');
                const delay = this.getDelayToNextUTCInterval();
                const nextUpdateTime = new Date(Date.now() + delay);
                console.log(`First update scheduled for UTC: ${nextUpdateTime.toISOString()}`);

                this.startPreciseInterval(delay);
            } else {
                console.log('Market worker started in cron-trigger mode');
            }
        } catch (error) {
            console.error('Error starting market worker:', error);
            this.isRunning = false;
            if (this.continuousMode) {
                setTimeout(() => this.start(), 10000);
            }
        }
    }

    startPreciseInterval(initialDelay = 0) {
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
        }

        setTimeout(() => {
            if (!this.isRunning || !this.continuousMode) return;

            this.performUpdateAsync();

            this.intervalTimer = setInterval(() => {
                if (this.isRunning && this.continuousMode) {
                    this.performUpdateAsync();
                }
            }, this.updateInterval);

        }, initialDelay);
    }

    performUpdateAsync() {
        const updateId = Date.now().toString();

        if (this.activeUpdates.size >= this.maxConcurrentUpdates) {
            console.warn(`Skipping update - max concurrent updates reached (${this.activeUpdates.size}/${this.maxConcurrentUpdates})`);
            return;
        }

        this.activeUpdates.add(updateId);

        this.performOptimizedUpdate(updateId)
            .catch(error => {
                console.error(`Update [${updateId}] failed:`, error);
            })
            .finally(() => {
                this.activeUpdates.delete(updateId);
            });
    }

    async triggerCycle() {
        try {
            if (this.isCycleActive) {
                console.log('Market cycle already active, skipping trigger');
                return { message: 'Cycle already active' };
            }

            console.log('Triggering market cycle from external cron job');
            this.isCycleActive = true;
            const cycleStartTime = Date.now();

            this.cycleTimeout = setInterval(async () => {
                if (this.isCycleActive) {
                    this.performUpdateAsync();
                }
            }, 30000);

            setTimeout(() => {
                this.stopCycle();
                console.log('Market cycle completed - stopping after 55 seconds');
            }, 55000);

            // Perform first update immediately
            const firstUpdate = await this.performOptimizedUpdate('cycle-initial');

            return {
                message: 'Market cycle started',
                firstUpdate: firstUpdate,
                cycleStartTime: new Date(cycleStartTime).toISOString()
            };

        } catch (error) {
            console.error('Error in market cycle trigger:', error);
            this.stopCycle();
            throw error;
        }
    }

    async performOptimizedUpdate(updateId = 'default') {
        const updateStartTime = Date.now();
        const updateStartUTC = new Date(updateStartTime).toISOString();

        try {
            console.log(`Starting market update [${updateId}] at UTC: ${updateStartUTC}`);

            await dbConnect();

            // Step 1: Get price updates
            const priceUpdateStart = Date.now();
            const updates = await updateAllStockPrices();
            const priceUpdateDuration = Date.now() - priceUpdateStart;

            this.lastUpdateTime = updateStartTime;
            this.lastUpdateData = updates;

            // Step 2: Batch process candlesticks
            const candlestickStart = Date.now();
            await updateCandlesticksBatch(updates);
            const candlestickDuration = Date.now() - candlestickStart;

            // Step 3: Publish to Redis/cache
            const publishStart = Date.now();
            await this.publishUpdates(updates);
            const publishDuration = Date.now() - publishStart;

            const totalDuration = Date.now() - updateStartTime;

            console.log(`Market update [${updateId}] completed | Stocks: ${updates.length} | Total: ${totalDuration}ms | Price: ${priceUpdateDuration}ms | Candlestick: ${candlestickDuration}ms | Publish: ${publishDuration}ms`);

            return updates;

        } catch (error) {
            const updateDuration = Date.now() - updateStartTime;
            console.error(`Error in market update [${updateId}] after ${updateDuration}ms:`, error);
            throw error;
        }
    }

    async publishUpdates(updates) {
        const now = Date.now();

        // Throttle publishing
        if (now - this.lastPublishTime < this.publishThrottle) {
            return;
        }

        this.lastPublishTime = now;

        // Check Redis health periodically
        if (!this.redisHealthy) {
            if (now % 30000 < 1000) { // Check every ~30 seconds
                console.log('Checking Redis health status...');
                await this.checkRedisHealth();
            }
            return;
        }

        try {
            // Create optimized payload for Upstash
            const optimizedPayload = {
                timestamp: now,
                count: updates.length,
                updates: updates.slice(0, 50).map(update => ({
                    symbol: update.symbol,
                    price: Number((update.price || update.currentPrice).toFixed(2)),
                    change: Number((update.change || 0).toFixed(2)),
                    changePercent: Number((update.changePercent || 0).toFixed(2))
                }))
            };

            const payloadString = JSON.stringify(optimizedPayload);

            // Use Upstash Redis HTTP API - much more reliable
            const operations = await Promise.allSettled([
                // Store latest data with TTL
                redis.setex('latest-stock-data', 300, payloadString),

                // Store individual stock data for quick lookup
                ...updates.slice(0, 20).map(update =>
                    redis.setex(
                        `stock:${update.symbol}`,
                        300,
                        JSON.stringify({
                            symbol: update.symbol,
                            price: update.price || update.currentPrice,
                            change: update.change || 0,
                            changePercent: update.changePercent || 0,
                            timestamp: now
                        })
                    )
                ),

                // For real-time updates, use a simple list approach instead of pub/sub
                redis.lpush('stock-updates-feed', payloadString),
                redis.ltrim('stock-updates-feed', 0, 99) // Keep only last 100 updates
            ]);

            // Log any failed operations
            const failed = operations.filter(op => op.status === 'rejected');
            if (failed.length > 0) {
                console.warn(`${failed.length} Redis operations failed:`, failed.map(f => f.reason?.message).join(', '));
            }

            const successful = operations.filter(op => op.status === 'fulfilled').length;
            console.log(`Redis operations completed: ${successful}/${operations.length} successful`);

        } catch (error) {
            console.error('Error in Redis publishing:', error.message);
            this.redisHealthy = false;
        }
    }

    stop() {
        this.isRunning = false;
        this.stopCycle();

        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = null;
        }
    }

    stopCycle() {
        this.isCycleActive = false;
        if (this.cycleTimeout) {
            clearInterval(this.cycleTimeout);
            this.cycleTimeout = null;
        }
    }

    getCycleStatus() {
        const nextUpdateTime = this.continuousMode ?
            new Date(this.getNextUTCAlignedTime()).toISOString() : null;

        return {
            isActive: this.isCycleActive,
            lastUpdateTime: this.lastUpdateTime,
            lastUpdateTimeUTC: this.lastUpdateTime ? new Date(this.lastUpdateTime).toISOString() : null,
            nextUpdateTimeUTC: nextUpdateTime,
            isRunning: this.isRunning,
            continuousMode: this.continuousMode,
            mode: this.continuousMode ? 'continuous' : 'cron-triggered',
            updateInterval: this.updateInterval,
            activeUpdates: this.activeUpdates.size,
            maxConcurrentUpdates: this.maxConcurrentUpdates,
            optimization: 'upstash-http-api',
            redisHealthy: this.redisHealthy
        };
    }
}

// Create singleton instance
const marketWorker = new OptimizedMarketWorker();

// Express routes
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
    const redisHealthy = await checkRedisHealth();

    res.json({
        status: redisHealthy ? 'ok' : 'degraded',
        service: 'market-worker-upstash-http',
        timestamp: new Date().toISOString(),
        redis: {
            healthy: redisHealthy,
            provider: 'upstash-http',
            api: 'REST'
        },
        workerStatus: marketWorker.getCycleStatus()
    });
});

// Trigger endpoint
app.post('/trigger-cycle', async (req, res) => {
    try {
        const result = await marketWorker.triggerCycle();
        const status = marketWorker.getCycleStatus();

        res.json({
            success: true,
            message: 'Market cycle triggered successfully',
            mode: status.mode,
            continuousMode: status.continuousMode,
            optimization: 'upstash-http-api',
            redis: {
                healthy: status.redisHealthy,
                provider: 'upstash-http',
                api: 'REST'
            },
            data: result
        });
    } catch (error) {
        console.error('Error triggering market cycle:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Performance metrics endpoint
app.get('/metrics', (req, res) => {
    const status = marketWorker.getCycleStatus();
    res.json({
        performance: {
            lastUpdateTime: status.lastUpdateTime,
            activeUpdates: status.activeUpdates,
            maxConcurrentUpdates: status.maxConcurrentUpdates,
            optimization: 'upstash-http-api',
            redis: {
                healthy: status.redisHealthy,
                provider: 'upstash-http',
                api: 'REST',
                throttle: '2000ms'
            },
            features: [
                'upstash_http_api',
                'batch_candlestick_processing',
                'automatic_retries',
                'health_monitoring',
                'graceful_degradation',
                'optimized_payloads'
            ]
        },
        status
    });
});

// API endpoint to get latest stock data
app.get('/api/stocks/latest', async (req, res) => {
    try {
        const data = await redis.get('latest-stock-data');
        if (data) {
            res.json(JSON.parse(data));
        } else {
            res.json({ message: 'No recent stock data available' });
        }
    } catch (error) {
        console.error('Error fetching latest stock data:', error);
        res.status(500).json({ error: 'Failed to fetch stock data' });
    }
});

// API endpoint to get specific stock data
app.get('/api/stocks/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const data = await redis.get(`stock:${symbol.toUpperCase()}`);

        if (data) {
            res.json(JSON.parse(data));
        } else {
            res.status(404).json({ error: 'Stock not found' });
        }
    } catch (error) {
        console.error(`Error fetching stock data for ${req.params.symbol}:`, error);
        res.status(500).json({ error: 'Failed to fetch stock data' });
    }
});

// API endpoint to get recent updates feed
app.get('/api/stocks/feed', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const feed = await redis.lrange('stock-updates-feed', 0, limit - 1);

        const updates = feed.map(item => {
            try {
                return JSON.parse(item);
            } catch (e) {
                return null;
            }
        }).filter(Boolean);

        res.json({ updates, count: updates.length });
    } catch (error) {
        console.error('Error fetching stock feed:', error);
        res.status(500).json({ error: 'Failed to fetch stock feed' });
    }
});

// Start the market worker
marketWorker.start().catch(error => {
    console.error('Failed to start market worker:', error);
    process.exit(1);
});

// Graceful shutdown
const shutdown = async () => {
    console.log('Shutting down market worker gracefully');
    marketWorker.stop();
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.listen(port, () => {
    console.log(`Market Worker Service (Upstash HTTP) running on port ${port}`);
});