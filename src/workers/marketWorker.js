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
    }

    async start() {
        if (this.isRunning) return;

        try {
            this.isRunning = true;
            await dbConnect();

            // Align updates to fixed time intervals
            const now = Date.now();
            const nextInterval = Math.ceil(now / this.updateInterval) * this.updateInterval;
            const delay = nextInterval - now;

            // Wait until the next aligned interval
            this.scheduleNextUpdate(delay);
        } catch (error) {
            console.error('Error starting market worker:', error);
            this.isRunning = false;
            // Try to restart after 5 seconds
            this.retryTimeout = setTimeout(() => this.start(), 5000);
        }
    }

    stop() {
        this.isRunning = false;
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
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
        this.retryTimeout = setTimeout(() => this.runUpdateLoop(), delay);
    }

    async runUpdateLoop() {
        if (!this.isRunning) return;

        try {
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

            // Schedule next update at the next fixed interval
            const now = Date.now();
            const nextInterval = Math.ceil(now / this.updateInterval) * this.updateInterval;
            const delay = nextInterval - now;

            this.scheduleNextUpdate(delay);
        } catch (error) {
            console.error('Error in market worker update loop:', error);
            if (this.isRunning) {
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
}

// Create a singleton instance
const marketWorker = new MarketWorker();

export default marketWorker;