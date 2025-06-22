class StockCache {
    constructor() {
        this.cache = new Map();
        this.EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes
    }

    getKey(symbol, timeframe) {
        return `${symbol}_${timeframe}`;
    }

    get(symbol, timeframe) {
        const key = this.getKey(symbol, timeframe);
        const data = this.cache.get(key);
        
        if (!data) return null;
        
        // Check if data is expired
        if (Date.now() - data.timestamp > this.EXPIRY_TIME) {
            this.cache.delete(key);
            return null;
        }
        
        console.log(`✅ Cache hit for ${symbol} (${timeframe}):`, {
            candles: data.candles.length,
            timestamp: new Date(data.timestamp).toLocaleString()
        });
        
        return data.candles;
    }

    set(symbol, timeframe, candles) {
        const key = this.getKey(symbol, timeframe);
        this.cache.set(key, {
            candles,
            timestamp: Date.now()
        });
        console.log(`💾 Cached ${candles.length} candles for ${symbol} (${timeframe})`);
    }

    clear() {
        this.cache.clear();
        console.log('🧹 Cache cleared');
    }
}

export const stockCache = new StockCache();
