import { updateAllStockPrices } from '../lib/marketEngine';
import { updateCandlesticks } from '../lib/candlestickAggregator';
import dbConnect from '../lib/db';

class MarketWorker {
    constructor() {
        this.isRunning = false;
        this.lastUpdateTime = null;
        this.lastUpdateData = null;
        this.listeners = new Set();
        this.updateInterval = 30000; // 30 seconds
        this.retryTimeout = null;
        this.cycleTimeout = null;
        this.isCycleActive = false;
        this.continuousMode = process.env.CONTINUOUS_ENGINE === 'true';
    }

    async start() {
        if (this.isRunning) return;

        try {
            this.isRunning = true;
            await dbConnect();

            // Only start continuous updates if CONTINUOUS_ENGINE is true
            if (this.continuousMode) {
                console.log('Starting market worker in continuous mode');
                // Align updates to fixed time intervals
                const now = Date.now();
                const nextInterval = Math.ceil(now / this.updateInterval) * this.updateInterval;
                const delay = nextInterval - now;

                // Wait until the next aligned interval
                this.scheduleNextUpdate(delay);
            } else {
                console.log('Market worker started in cron-trigger mode (continuous updates disabled)');
            }
        } catch (error) {
            console.error('Error starting market worker:', error);
            this.isRunning = false;
            // Try to restart after 5 seconds only if in continuous mode
            if (this.continuousMode) {
                this.retryTimeout = setTimeout(() => this.start(), 5000);
            }
        }
    }

    stop() {
        this.isRunning = false;
        this.stopCycle();
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }
    }

    stopCycle() {
        this.isCycleActive = false;
        if (this.cycleTimeout) {
            clearTimeout(this.cycleTimeout);
            this.cycleTimeout = null;
        }
    }

    // New method to trigger a 55-second cycle from external cron job
    async triggerCycle() {
        try {
            if (this.isCycleActive) {
                console.log('Market cycle already active, skipping trigger');
                return { message: 'Cycle already active' };
            }

            console.log('Triggering market cycle from external cron job');
            this.isCycleActive = true;

            // Record the cycle start time
            const cycleStartTime = Date.now();

            // Schedule the second update exactly 30 seconds from cycle start
            this.cycleTimeout = setTimeout(async () => {
                if (this.isCycleActive) {
                    await this.performUpdate();
                }
            }, 30000);

            // Stop the cycle after 55 seconds from cycle start
            setTimeout(() => {
                this.stopCycle();
                console.log('Market cycle completed - stopping after 55 seconds');
            }, 55000);

            // Start the first update (this can take variable time)
            const firstUpdate = await this.performUpdate();

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

    // Extract the update logic into a separate method
    async performUpdate() {
        try {
            await dbConnect();

            // Update prices
            const updates = await updateAllStockPrices();
            this.lastUpdateTime = Date.now();
            this.lastUpdateData = updates;

            // Update candlesticks for each stock
            for (const update of updates) {
                try {
                    await updateCandlesticks(
                        update._id,
                        update.price,
                        update.timestamp || new Date()
                    );
                } catch (error) {
                    console.error(`Error updating candlesticks for stock ${update.symbol}:`, error);
                }
            }

            // Notify all listeners with the full updates including candlestick data
            this.notifyListeners(updates);

            console.log(`Market update completed at ${new Date().toISOString()}, ${updates.length} stocks updated`);
            return updates;

        } catch (error) {
            console.error('Error performing market update:', error);
            throw error;
        }
    }

    addListener(listener) {
        this.listeners.add(listener);
        // If we have last update data, send it immediately
        if (this.lastUpdateTime && this.lastUpdateData) {
            try {
                listener(this.lastUpdateData);
            } catch (error) {
                console.error('Error in listener:', error);
            }
        }
        return () => this.listeners.delete(listener);
    }

    scheduleNextUpdate(delay) {
        // Only schedule next update if in continuous mode
        if (this.continuousMode) {
            this.retryTimeout = setTimeout(() => this.runUpdateLoop(), delay);
        }
    }

    async runUpdateLoop() {
        if (!this.isRunning || !this.continuousMode) return;

        try {
            await this.performUpdate();

            // Schedule next update at the next fixed interval
            const now = Date.now();
            const nextInterval = Math.ceil(now / this.updateInterval) * this.updateInterval;
            const delay = nextInterval - now;

            this.scheduleNextUpdate(delay);
        } catch (error) {
            console.error('Error in market worker update loop:', error);
            if (this.isRunning && this.continuousMode) {
                // If there was an error, try again after 5 seconds
                this.scheduleNextUpdate(5000);
            }
        }
    }

    notifyListeners(updates) {
        this.listeners.forEach(listener => {
            try {
                listener(updates);
            } catch (error) {
                console.error('Error in listener:', error);
            }
        });
    }

    // Method to check if cycle is currently active
    isCycleRunning() {
        return this.isCycleActive;
    }

    // Method to get cycle status
    getCycleStatus() {
        return {
            isActive: this.isCycleActive,
            lastUpdateTime: this.lastUpdateTime,
            isRunning: this.isRunning,
            continuousMode: this.continuousMode,
            mode: this.continuousMode ? 'continuous' : 'cron-triggered'
        };
    }
}

// Create a singleton instance
const marketWorker = new MarketWorker();

export default marketWorker;