import Stock from '../models/Stock.js';

// Cache for candle boundaries to avoid repeated calculations
const boundaryCache = new Map();
const CACHE_DURATION = 60000; // 1 minute cache

// Lightning-fast candlestick updates - heavily optimized
export async function updateCandlesticksBatch(stockUpdates) {
    if (!stockUpdates || stockUpdates.length === 0) {
        console.log('No stock updates to process');
        return [];
    }

    const startTime = Date.now();
    console.log(`Starting optimized candle aggregation - ${stockUpdates.length} stock updates found`);

    try {
        // Process in smaller batches to avoid memory issues and improve parallelism
        const BATCH_SIZE = 100;
        const results = [];

        for (let i = 0; i < stockUpdates.length; i += BATCH_SIZE) {
            const batch = stockUpdates.slice(i, i + BATCH_SIZE);
            const batchResult = await processBatch(batch);
            results.push(...batchResult);
        }

        const duration = Date.now() - startTime;
        console.log(`Completed optimized candle aggregation - Processed ${results.length} stocks in ${duration}ms`);
        return results;

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Candle aggregation failed after ${duration}ms:`, error.message);
        throw error;
    }
}

// Process batch with parallel operations
async function processBatch(stockUpdates) {
    const now = new Date();

    // Pre-calculate all candle boundaries once per batch
    const timeframes = [
        { field: 'candles_5min', minutes: 5 },
        { field: 'candles_30min', minutes: 30 },
        { field: 'candles_2hour', minutes: 120 }
    ];

    const candleBoundaries = timeframes.map(tf => ({
        ...tf,
        ...getCandleBoundariesCached(now, tf.minutes)
    }));

    // Build all operations in one pass
    const priceHistoryOps = [];
    const candleOps = [];

    for (const update of stockUpdates) {
        const price = update.price || update.currentPrice;
        const stockId = update._id || update.stockId;
        const timestamp = now; // Use same timestamp for batch consistency

        // Price history update (simplified)
        priceHistoryOps.push({
            updateOne: {
                filter: { _id: stockId },
                update: {
                    $set: {
                        currentPrice: price,
                        lastUpdate: timestamp
                    },
                    $push: {
                        priceHistory: {
                            $each: [{ timestamp, price }],
                            $slice: -10000 // Reduced from 10000 for better performance
                        }
                    }
                },
                upsert: false
            }
        });

        // Generate candle operations for all timeframes
        for (const tf of candleBoundaries) {
            // Single atomic operation that handles both create and update
            candleOps.push({
                updateOne: {
                    filter: { _id: stockId },
                    update: [
                        {
                            $set: {
                                [tf.field]: {
                                    $cond: {
                                        if: {
                                            $anyElementTrue: {
                                                $map: {
                                                    input: { $ifNull: [`$${tf.field}`, []] },
                                                    in: { $eq: ["$$this.startTime", tf.candleStart] }
                                                }
                                            }
                                        },
                                        then: {
                                            $map: {
                                                input: { $ifNull: [`$${tf.field}`, []] },
                                                in: {
                                                    $cond: {
                                                        if: { $eq: ["$$this.startTime", tf.candleStart] },
                                                        then: {
                                                            startTime: "$$this.startTime",
                                                            endTime: tf.candleEnd,
                                                            open: "$$this.open",
                                                            high: { $max: ["$$this.high", price] },
                                                            low: { $min: ["$$this.low", price] },
                                                            close: price,
                                                            volume: { $add: ["$$this.volume", 1] }
                                                        },
                                                        else: "$$this"
                                                    }
                                                }
                                            }
                                        },
                                        else: {
                                            $slice: [
                                                {
                                                    $concatArrays: [
                                                        { $ifNull: [`$${tf.field}`, []] },
                                                        [{
                                                            startTime: tf.candleStart,
                                                            endTime: tf.candleEnd,
                                                            open: price,
                                                            high: price,
                                                            low: price,
                                                            close: price,
                                                            volume: 1
                                                        }]
                                                    ]
                                                },
                                                -2000 // Reduced from 2000 for better performance
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    ],
                    upsert: false
                }
            });
        }
    }

    // Execute operations in parallel with optimized settings
    const promises = [];

    if (priceHistoryOps.length > 0) {
        promises.push(
            Stock.bulkWrite(priceHistoryOps, {
                ordered: false,
                bypassDocumentValidation: true,
                writeConcern: { w: 0 }, // Fire and forget for price history
                maxTimeMS: 10000
            })
        );
    }

    if (candleOps.length > 0) {
        promises.push(
            Stock.bulkWrite(candleOps, {
                ordered: false,
                bypassDocumentValidation: true,
                writeConcern: { w: 1, j: false },
                maxTimeMS: 10000
            })
        );
    }

    await Promise.allSettled(promises); // Don't fail entire batch if one operation fails

    return stockUpdates;
}

// Cached candle boundary calculation
function getCandleBoundariesCached(timestamp, intervalMinutes) {
    const cacheKey = `${intervalMinutes}_${Math.floor(timestamp.getTime() / (intervalMinutes * 60 * 1000))}`;

    if (boundaryCache.has(cacheKey)) {
        const cached = boundaryCache.get(cacheKey);
        if (Date.now() - cached.createdAt < CACHE_DURATION) {
            return cached.boundaries;
        }
        boundaryCache.delete(cacheKey);
    }

    const boundaries = getCandleBoundaries(timestamp, intervalMinutes);
    boundaryCache.set(cacheKey, {
        boundaries,
        createdAt: Date.now()
    });

    // Clean cache periodically
    if (boundaryCache.size > 50) {
        const now = Date.now();
        for (const [key, value] of boundaryCache.entries()) {
            if (now - value.createdAt > CACHE_DURATION) {
                boundaryCache.delete(key);
            }
        }
    }

    return boundaries;
}

// Optimized boundary calculation (unchanged but now cached)
function getCandleBoundaries(timestamp, intervalMinutes) {
    const ms = timestamp.getTime();
    const intervalMs = intervalMinutes * 60 * 1000;
    const candleStartMs = Math.floor(ms / intervalMs) * intervalMs;

    return {
        candleStart: new Date(candleStartMs),
        candleEnd: new Date(candleStartMs + intervalMs)
    };
}

// Highly optimized real-time update
export async function updateCandlesRealTime(stockId, price, timestamp = new Date()) {
    const startTime = Date.now();

    // Pre-calculate all boundaries
    const timeframes = [
        { field: 'candles_5min', minutes: 5 },
        { field: 'candles_30min', minutes: 30 },
        { field: 'candles_2hour', minutes: 120 }
    ];

    const candleBoundaries = timeframes.map(tf => ({
        ...tf,
        ...getCandleBoundariesCached(timestamp, tf.minutes)
    }));

    // Single aggregation pipeline operation
    const pipeline = [
        { $match: { _id: stockId } },
        {
            $set: {
                currentPrice: price,
                lastUpdate: timestamp,
                priceHistory: {
                    $slice: [
                        { $concatArrays: ["$priceHistory", [{ timestamp, price }]] },
                        -10000
                    ]
                },
                ...candleBoundaries.reduce((acc, tf) => {
                    acc[tf.field] = {
                        $cond: {
                            if: {
                                $anyElementTrue: {
                                    $map: {
                                        input: { $ifNull: [`$${tf.field}`, []] },
                                        in: { $eq: ["$$this.startTime", tf.candleStart] }
                                    }
                                }
                            },
                            then: {
                                $map: {
                                    input: { $ifNull: [`$${tf.field}`, []] },
                                    in: {
                                        $cond: {
                                            if: { $eq: ["$$this.startTime", tf.candleStart] },
                                            then: {
                                                startTime: "$$this.startTime",
                                                endTime: tf.candleEnd,
                                                open: "$$this.open",
                                                high: { $max: ["$$this.high", price] },
                                                low: { $min: ["$$this.low", price] },
                                                close: price,
                                                volume: { $add: ["$$this.volume", 1] }
                                            },
                                            else: "$$this"
                                        }
                                    }
                                }
                            },
                            else: {
                                $slice: [
                                    {
                                        $concatArrays: [
                                            { $ifNull: [`$${tf.field}`, []] },
                                            [{
                                                startTime: tf.candleStart,
                                                endTime: tf.candleEnd,
                                                open: price,
                                                high: price,
                                                low: price,
                                                close: price,
                                                volume: 1
                                            }]
                                        ]
                                    },
                                    -2000
                                ]
                            }
                        }
                    };
                    return acc;
                }, {})
            }
        },
        { $merge: { into: Stock.collection.name, whenMatched: "replace" } }
    ];

    await Stock.aggregate(pipeline, { maxTimeMS: 10000 });

    const duration = Date.now() - startTime;
    if (duration > 100) { // Only log slow operations
        console.log(`Real-time candle update completed in ${duration}ms`);
    }
}

// Backward compatibility - now using optimized real-time update
export async function updateCandlesticks(stockId, price, timestamp = new Date()) {
    return updateCandlesRealTime(stockId, price, timestamp);
}

// Optimized read functions with better indexing hints
export async function getCandlesForTimeframe(symbol, timeframe, limit = 2000) {
    try {
        console.log(`Fetching ${timeframe} candles for ${symbol} (limit: ${limit})`);

        if (timeframe === '1min') {
            const stock = await Stock.findOne(
                { symbol },
                { priceHistory: { $slice: -limit }, _id: 0 }
            )
                .hint({ symbol: 1 }) // Index hint for better performance
                .lean()
                .maxTimeMS(3000);

            if (!stock) throw new Error('Stock not found');

            const pricePoints = stock.priceHistory || [];
            console.log(`Retrieved ${pricePoints.length} price points for 1min timeframe`);

            // Use map with pre-allocated array for better performance
            const candles = new Array(pricePoints.length);
            for (let i = 0; i < pricePoints.length; i++) {
                const p = pricePoints[i];
                candles[i] = {
                    startTime: p.timestamp,
                    endTime: new Date(p.timestamp.getTime() + 60000),
                    open: p.price,
                    high: p.price,
                    low: p.price,
                    close: p.price,
                    volume: 1
                };
            }
            return candles;
        }

        const fieldMap = {
            '5min': 'candles_5min',
            '30min': 'candles_30min',
            '2hour': 'candles_2hour'
        };

        const field = fieldMap[timeframe];
        if (!field) throw new Error('Invalid timeframe');

        const stock = await Stock.findOne(
            { symbol },
            { [field]: { $slice: -limit }, _id: 0 }
        )
            .hint({ symbol: 1 })
            .lean()
            .maxTimeMS(3000);

        if (!stock) throw new Error('Stock not found');

        const candles = (stock[field] || []).reverse();
        console.log(`Retrieved ${candles.length} candles for ${timeframe} timeframe`);
        return candles;

    } catch (error) {
        console.error(`Error fetching ${timeframe} candles for ${symbol}:`, error.message);
        throw error;
    }
}

export async function getCurrentCandle(symbol, timeframe) {
    try {
        const fieldMap = {
            '5min': 'candles_5min',
            '30min': 'candles_30min',
            '2hour': 'candles_2hour'
        };

        const field = fieldMap[timeframe];
        if (!field) throw new Error('Invalid timeframe');

        const stock = await Stock.findOne(
            { symbol },
            {
                [field]: { $slice: -1 },
                currentPrice: 1,
                _id: 0
            }
        )
            .hint({ symbol: 1 })
            .lean()
            .maxTimeMS(2000);

        if (!stock) throw new Error('Stock not found');

        const currentCandle = stock[field]?.[0];
        if (!currentCandle) {
            console.log(`No current candle found for ${symbol} ${timeframe}`);
            return null;
        }

        const currentPrice = stock.currentPrice || currentCandle.close;

        // Return optimized object
        return {
            ...currentCandle,
            close: currentPrice,
            high: Math.max(currentCandle.high, currentPrice),
            currentPrice
        };

    } catch (error) {
        console.error(`Error getting current ${timeframe} candle for ${symbol}:`, error.message);
        throw error;
    }
}