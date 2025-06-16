import Stock from '@/models/Stock';

const TIMEFRAMES = {
    '5min': {
        minutes: 5,
        field: 'candles_5min',
        lastCandleField: 'lastCandle_5min'
    },
    '30min': {
        minutes: 30,
        field: 'candles_30min',
        lastCandleField: 'lastCandle_30min'
    },
    '2hour': {
        minutes: 120,
        field: 'candles_2hour',
        lastCandleField: 'lastCandle_2hour'
    }
};

// Calculate start and end time for a candle
function getCandleTimes(timestamp, intervalMinutes) {
    const startTime = new Date(timestamp);
    startTime.setMilliseconds(0);
    startTime.setSeconds(0);
    startTime.setMinutes(Math.floor(startTime.getMinutes() / intervalMinutes) * intervalMinutes);

    const endTime = new Date(startTime);
    endTime.setMinutes(startTime.getMinutes() + intervalMinutes);

    return { startTime, endTime };
}

// Update or create a candle for a specific timeframe
async function updateTimeframeCandle(stock, price, timeframe, timestamp) {
    const { minutes, field, lastCandleField } = TIMEFRAMES[timeframe];
    const { startTime, endTime } = getCandleTimes(timestamp, minutes);

    // Find or create the current candle
    let currentCandle = stock[field].find(c =>
        c.startTime.getTime() === startTime.getTime() &&
        c.endTime.getTime() === endTime.getTime()
    );

    if (currentCandle) {
        // Update existing candle
        currentCandle.high = Math.max(currentCandle.high, price);
        currentCandle.low = Math.min(currentCandle.low, price);
        currentCandle.close = price;
        currentCandle.volume++;
    } else {
        // Create new candle
        currentCandle = {
            startTime,
            endTime,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: 1
        };
        stock[field].push(currentCandle);

        // Keep only the last 1000 candles per timeframe
        if (stock[field].length > 1000) {
            stock[field].shift();
        }
    }

    // Update last candle timestamp
    stock[lastCandleField] = timestamp;
}

// Main function to update candlesticks
export async function updateCandlesticks(stockId, price, timestamp = new Date()) {
    let retries = 3;  // Number of retry attempts
    let lastError;

    while (retries > 0) {
        try {
            // Find and update the stock in one atomic operation
            const stock = await Stock.findById(stockId);
            if (!stock) throw new Error('Stock not found');

            // Add to raw price history
            stock.priceHistory.push({
                timestamp,
                price
            });

            // Keep only last 24 hours of raw price history
            const cutoff = new Date(timestamp.getTime() - 24 * 60 * 60 * 1000);
            stock.priceHistory = stock.priceHistory.filter(p => p.timestamp >= cutoff);

            // Update candles for each timeframe
            for (const timeframe of Object.keys(TIMEFRAMES)) {
                await updateTimeframeCandle(stock, price, timeframe, timestamp);
            }

            // Save with optimistic concurrency control
            await stock.save();
            return stock;

        } catch (error) {
            lastError = error;
            if (error.name === 'VersionError') {
                // If it's a version conflict, wait a short random time and retry
                const delay = Math.random() * 100;  // Random delay between 0-100ms
                await new Promise(resolve => setTimeout(resolve, delay));
                retries--;
                continue;
            }
            // If it's not a version error, throw immediately
            throw error;
        }
    }

    // If we've exhausted all retries, throw the last error
    throw lastError;
}

// Function to get candles for a specific timeframe
export async function getCandlesForTimeframe(symbol, timeframe, limit = 100) {
    try {
        const stock = await Stock.findOne({ symbol });
        if (!stock) throw new Error('Stock not found');

        if (timeframe === '1min') {
            // For 1-minute view, use raw price history
            const prices = stock.priceHistory.slice(-limit);
            return prices.map((p, i) => ({
                startTime: p.timestamp,
                endTime: new Date(p.timestamp.getTime() + 60000),
                open: p.price,
                high: p.price,
                low: p.price,
                close: p.price,
                volume: 1
            }));
        }

        // For other timeframes, return the corresponding candlestick data
        const field = TIMEFRAMES[timeframe]?.field;
        if (!field) throw new Error('Invalid timeframe');

        return stock[field]
            .sort((a, b) => b.startTime - a.startTime)
            .slice(0, limit)
            .reverse();
    } catch (error) {
        console.error('Error fetching candles:', error);
        throw error;
    }
}

// Get the current (in-progress) candle for live updates
export async function getCurrentCandle(symbol, timeframe) {
    try {
        const stock = await Stock.findOne({ symbol });
        if (!stock) throw new Error('Stock not found');

        const { minutes, field } = TIMEFRAMES[timeframe] || { minutes: 1 };
        const now = new Date();
        const { startTime, endTime } = getCandleTimes(now, minutes);

        // For 1-minute timeframe
        if (timeframe === '1min') {
            const currentPrices = stock.priceHistory.filter(p =>
                p.timestamp >= startTime && p.timestamp < endTime
            );
            if (currentPrices.length === 0) return null;

            return {
                startTime,
                endTime,
                open: currentPrices[0].price,
                high: Math.max(...currentPrices.map(p => p.price)),
                low: Math.min(...currentPrices.map(p => p.price)),
                close: currentPrices[currentPrices.length - 1].price,
                currentPrice: stock.currentPrice,
                volume: currentPrices.length
            };
        }

        // For other timeframes, get the current candle and add currentPrice
        const currentCandle = stock[field].find(c =>
            c.startTime.getTime() === startTime.getTime() &&
            c.endTime.getTime() === endTime.getTime()
        );

        if (!currentCandle) return null;

        return {
            ...currentCandle.toObject(),
            currentPrice: stock.currentPrice
        };
    } catch (error) {
        console.error('Error getting current candle:', error);
        throw error;
    }
}