import { updateAllStockPrices } from '../lib/marketEngine';
import dbConnect from '../lib/db';

class MarketWorker {
    constructor() {
        this.isRunning = false;
        this.lastUpdateTime = null;
        this.listeners = new Set();
        this.updateInterval = 30000; // 30 seconds
    }

    async start() {
        if (this.isRunning) return;

        this.isRunning = true;
        await dbConnect();

        // Align updates to fixed time intervals
        const now = Date.now();
        const nextInterval = Math.ceil(now / this.updateInterval) * this.updateInterval;
        const delay = nextInterval - now;

        // Wait until the next aligned interval
        setTimeout(() => this.runUpdateLoop(), delay);
    }

    stop() {
        this.isRunning = false;
    }

    addListener(listener) {
        this.listeners.add(listener);
        // If we have last update data, send it immediately
        if (this.lastUpdateTime && this.lastUpdateData) {
            listener(this.lastUpdateData);
        }
        return () => this.listeners.delete(listener);
    }

    async runUpdateLoop() {
        if (!this.isRunning) return;

        try {
            // Update prices
            const updates = await updateAllStockPrices();
            this.lastUpdateTime = Date.now();
            this.lastUpdateData = updates;

            // Notify all listeners
            this.listeners.forEach(listener => {
                try {
                    listener(updates);
                } catch (error) {
                    console.error('Error in listener:', error);
                }
            });
        } catch (error) {
            console.error('Error updating prices:', error);
        }

        // Schedule next update at the next fixed interval
        const now = Date.now();
        const nextInterval = Math.ceil(now / this.updateInterval) * this.updateInterval;
        const delay = nextInterval - now;

        setTimeout(() => this.runUpdateLoop(), delay);
    }
}

// Create a singleton instance
const marketWorker = new MarketWorker();

export default marketWorker; 