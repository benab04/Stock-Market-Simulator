import Stock from '../models/Stock.js';

// Lightning-fast candlestick updates - minimal database operations
export async function updateCandlesticksBatch(stockUpdates) {
    if (!stockUpdates || stockUpdates.length === 0) return [];

    const startTime = Date.now();

    try {
        // Create ultra-minimal bulk operations - just price and timestamp
        const bulkOps = stockUpdates.map(update => {
            const price = update.price || update.currentPrice;
            const timestamp = new Date();

            return {
                updateOne: {
                    filter: { _id: update._id || update.stockId },
                    update: {
                        $set: {
                            currentPrice: price,
                            lastUpdate: timestamp
                        },
                        $push: {
                            priceHistory: {
                                $each: [{ timestamp, price }],
                                $slice: -2000 // Keep only last 2000 points
                            }
                        }
                    }
                }
            };
        });

        // Execute with maximum performance settings
        await Stock.bulkWrite(bulkOps, {
            ordered: false,
            bypassDocumentValidation: true,
            writeConcern: { w: 1, j: false } // Fastest write concern
        });

        const duration = Date.now() - startTime;
        console.log(`Lightning candlestick update: ${bulkOps.length} stocks in ${duration}ms`);
        return stockUpdates;

    } catch (error) {
        console.error('Lightning candlestick update failed:', error);

        // Ultra-simple fallback - just update prices
        try {
            const fallbackOps = stockUpdates.map(update => ({
                updateOne: {
                    filter: { _id: update._id || update.stockId },
                    update: { $set: { currentPrice: update.price || update.currentPrice } }
                }
            }));

            await Stock.bulkWrite(fallbackOps, {
                ordered: false,
                writeConcern: { w: 1, j: false }
            });

            console.log('Fallback price-only update completed');
        } catch (fallbackError) {
            console.error('Fallback failed:', fallbackError);
        }

        throw error;
    }
}

// Backward compatibility
export async function updateCandlesticks(stockId, price, timestamp = new Date()) {
    return updateCandlesticksBatch([{ _id: stockId, price, timestamp }]);
}

// Background candle generation (run separately, not blocking main updates)
export async function generateCandlesBackground() {
    try {
        const stocks = await Stock.find({}, {
            priceHistory: { $slice: -500 },
            symbol: 1
        }).lean();

        console.log(`Background candle generation for ${stocks.length} stocks started`);

        // Process in chunks to avoid memory issues
        const chunkSize = 10;
        for (let i = 0; i < stocks.length; i += chunkSize) {
            const chunk = stocks.slice(i, i + chunkSize);
            await processChunkCandles(chunk);
        }

        console.log('Background candle generation completed');

    } catch (error) {
        console.error('Background candle generation failed:', error);
    }
}

async function processChunkCandles(stockChunk) {
    const bulkOps = [];

    for (const stock of stockChunk) {
        if (!stock.priceHistory || stock.priceHistory.length < 2) continue;

        try {
            // Generate candles from recent price history
            const candles5min = generateCandlesFromHistory(stock.priceHistory, 5);
            const candles30min = generateCandlesFromHistory(stock.priceHistory, 30);
            const candles2hour = generateCandlesFromHistory(stock.priceHistory, 120);

            bulkOps.push({
                updateOne: {
                    filter: { _id: stock._id },
                    update: {
                        $set: {
                            candles_5min: candles5min,
                            candles_30min: candles30min,
                            candles_2hour: candles2hour
                        }
                    }
                }
            });

        } catch (error) {
            console.error(`Error generating candles for ${stock.symbol}:`, error);
        }
    }

    if (bulkOps.length > 0) {
        await Stock.bulkWrite(bulkOps, {
            ordered: false,
            writeConcern: { w: 1, j: false }
        });
    }
}

function generateCandlesFromHistory(priceHistory, intervalMinutes) {
    if (!priceHistory || priceHistory.length === 0) return [];

    const candles = [];
    const intervalMs = intervalMinutes * 60 * 1000;

    // Group prices by time intervals
    const groups = {};

    for (const point of priceHistory) {
        const timestamp = point.timestamp.getTime();
        const intervalStart = Math.floor(timestamp / intervalMs) * intervalMs;

        if (!groups[intervalStart]) {
            groups[intervalStart] = [];
        }
        groups[intervalStart].push(point);
    }

    // Create candles from groups
    for (const [intervalStart, points] of Object.entries(groups)) {
        if (points.length === 0) continue;

        const prices = points.map(p => p.price);
        const startTime = new Date(parseInt(intervalStart));
        const endTime = new Date(parseInt(intervalStart) + intervalMs);

        candles.push({
            startTime,
            endTime,
            open: prices[0],
            high: Math.max(...prices),
            low: Math.min(...prices),
            close: prices[prices.length - 1],
            volume: prices.length
        });
    }

    // Sort by time and keep only recent candles
    return candles
        .sort((a, b) => a.startTime - b.startTime)
        .slice(-500); // Keep last 500 candles
}

// Fast read functions (optimized for display)
export async function getCandlesForTimeframe(symbol, timeframe, limit = 500) {
    try {
        if (timeframe === '1min') {
            // For 1-minute, use price history directly
            const stock = await Stock.findOne({ symbol }, {
                priceHistory: { $slice: -limit }
            }).lean();

            if (!stock) throw new Error('Stock not found');

            return stock.priceHistory.map(p => ({
                startTime: p.timestamp,
                endTime: new Date(p.timestamp.getTime() + 60000),
                open: p.price,
                high: p.price,
                low: p.price,
                close: p.price,
                volume: 1
            }));
        }

        // For other timeframes, get from candles collection
        const fieldMap = {
            '5min': 'candles_5min',
            '30min': 'candles_30min',
            '2hour': 'candles_2hour'
        };

        const field = fieldMap[timeframe];
        if (!field) throw new Error('Invalid timeframe');

        const stock = await Stock.findOne({ symbol }, {
            [field]: { $slice: -limit }
        }).lean();

        if (!stock) throw new Error('Stock not found');

        return (stock[field] || []).reverse();

    } catch (error) {
        console.error('Error fetching candles:', error);
        throw error;
    }
}

export async function getCurrentCandle(symbol, timeframe) {
    try {
        const stock = await Stock.findOne({ symbol }, {
            priceHistory: { $slice: -10 },
            currentPrice: 1
        }).lean();

        if (!stock) throw new Error('Stock not found');

        const now = new Date();
        const recentPrice = stock.priceHistory[stock.priceHistory.length - 1];

        if (!recentPrice) return null;

        return {
            startTime: now,
            endTime: new Date(now.getTime() + 60000),
            open: recentPrice.price,
            high: recentPrice.price,
            low: recentPrice.price,
            close: recentPrice.price,
            currentPrice: stock.currentPrice,
            volume: 1
        };

    } catch (error) {
        console.error('Error getting current candle:', error);
        throw error;
    }
}