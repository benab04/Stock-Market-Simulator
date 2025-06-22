// market-worker-service/index.js
import express from 'express';
import Redis from 'ioredis';
import dbConnect from './lib/db.js';
import { updateAllStockPrices } from './lib/marketEngine.js';
import { updateCandlesticksBatch } from './lib/candlestickAggregator.js';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 3001;

// Optimized Redis connection with pipeline support
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    enableAutoPipelining: true,
    maxRetriesPerRequest: 2,
    lazyConnect: true
});

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
        this.maxConcurrentUpdates = 1; // Reduced for better performance
        this.pipeline = null;
        this.lastPublishTime = 0;
        this.publishThrottle = 1000; // Minimum 1s between publishes
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

    async start() {
        if (this.isRunning) return;

        try {
            this.isRunning = true;
            await dbConnect();

            if (this.continuousMode) {
                console.log('Starting optimized market worker in continuous mode with UTC alignment');
                const delay = this.getDelayToNextUTCInterval();
                const nextUpdateTime = new Date(Date.now() + delay);
                console.log(`First update scheduled for UTC: ${nextUpdateTime.toISOString()}`);

                this.startPreciseInterval(delay);
            } else {
                console.log('Optimized market worker started in cron-trigger mode');
            }
        } catch (error) {
            console.error('Error starting optimized market worker:', error);
            this.isRunning = false;
            if (this.continuousMode) {
                setTimeout(() => this.start(), 5000);
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

        // Strict concurrency control for better performance
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

            console.log('Triggering optimized market cycle from external cron job');
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
                message: 'Optimized market cycle started',
                firstUpdate: firstUpdate,
                cycleStartTime: new Date(cycleStartTime).toISOString()
            };

        } catch (error) {
            console.error('Error in optimized market cycle trigger:', error);
            this.stopCycle();
            throw error;
        }
    }

    async performOptimizedUpdate(updateId = 'default') {
        const updateStartTime = Date.now();
        const updateStartUTC = new Date(updateStartTime).toISOString();

        try {
            console.log(`Starting optimized market update [${updateId}] at UTC: ${updateStartUTC}`);

            // Fresh DB connection
            await dbConnect();

            // Step 1: Get price updates (this should already be fast)
            const priceUpdateStart = Date.now();
            const updates = await updateAllStockPrices();
            const priceUpdateDuration = Date.now() - priceUpdateStart;

            this.lastUpdateTime = updateStartTime;
            this.lastUpdateData = updates;

            // Step 2: Batch process all candlesticks at once (major optimization)
            const candlestickStart = Date.now();
            await updateCandlesticksBatch(updates);
            const candlestickDuration = Date.now() - candlestickStart;

            // Step 3: Optimized Redis publishing (with throttling)
            const publishStart = Date.now();
            await this.publishUpdatesOptimized(updates);
            const publishDuration = Date.now() - publishStart;

            const totalDuration = Date.now() - updateStartTime;

            // Single consolidated log message with corrected timing
            console.log(`Market update [${updateId}] completed | Stocks: ${updates.length} | Total: ${totalDuration}ms | Price: ${priceUpdateDuration}ms | Candlestick: ${candlestickDuration}ms | Publish: ${publishDuration}ms`);

            return updates;

        } catch (error) {
            const updateDuration = Date.now() - updateStartTime;
            console.error(`Error in optimized market update [${updateId}] after ${updateDuration}ms:`, error);
            throw error;
        }
    }

    async publishUpdatesOptimized(updates) {
        const now = Date.now();

        // Throttle publishing to prevent Redis overload
        if (now - this.lastPublishTime < this.publishThrottle) {
            return;
        }

        this.lastPublishTime = now;

        try {
            // Create optimized payload (minimal data)
            const optimizedPayload = {
                timestamp: now,
                count: updates.length,
                updates: updates.map(update => ({
                    symbol: update.symbol,
                    price: update.price || update.currentPrice,
                    change: update.change,
                    changePercent: update.changePercent
                }))
            };

            const payloadString = JSON.stringify(optimizedPayload);

            // Use Redis pipeline for better performance
            const pipeline = redis.pipeline();
            pipeline.publish('stock-updates', payloadString);
            pipeline.setex('latest-stock-data', 300, payloadString);

            await pipeline.exec();

        } catch (error) {
            console.error('Error in optimized Redis publishing:', error);
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
            optimization: 'enabled'
        };
    }
}

// Create singleton instance
const marketWorker = new OptimizedMarketWorker();

// Express routes
app.use(express.json());

// Optimized health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'optimized-market-worker',
        timestamp: new Date().toISOString(),
        workerStatus: marketWorker.getCycleStatus()
    });
});

// Optimized trigger endpoint
app.post('/trigger-cycle', async (req, res) => {
    try {
        const result = await marketWorker.triggerCycle();
        const status = marketWorker.getCycleStatus();

        res.json({
            success: true,
            message: 'Optimized market cycle triggered successfully',
            mode: status.mode,
            continuousMode: status.continuousMode,
            optimization: 'enabled',
            data: result
        });
    } catch (error) {
        console.error('Error triggering optimized market cycle:', error);
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
            optimization: 'enabled',
            features: [
                'batch_candlestick_processing',
                'redis_pipelining',
                'publish_throttling',
                'memory_optimized_lookups',
                'single_bulk_write'
            ]
        },
        status
    });
});

// Start the optimized market worker
marketWorker.start().catch(error => {
    console.error('Failed to start optimized market worker:', error);
    process.exit(1);
});

// Graceful shutdown
const shutdown = () => {
    console.log('Shutting down optimized market worker gracefully');
    marketWorker.stop();
    redis.disconnect();
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.listen(port, () => {
    console.log(`Optimized Market Worker Service running on port ${port}`);
});