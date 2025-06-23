import Stock from '../models/Stock.js';

// Lightning-fast candlestick updates - minimal database operations
export async function updateCandlesticksBatch(stockUpdates) {
    if (!stockUpdates || stockUpdates.length === 0) {
        console.log('No stock updates to process');
        return [];
    }

    const startTime = Date.now();
    console.log(`Starting candle aggregation - ${stockUpdates.length} stock updates found`);

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
                                $slice: -10000 // Keep only last 10000 points
                            }
                        }
                    }
                }
            };
        });

        // Execute with maximum performance settings
        console.log(`Updating price history for ${bulkOps.length} stocks`);
        await Stock.bulkWrite(bulkOps, {
            ordered: false,
            bypassDocumentValidation: true,
            writeConcern: { w: 1, j: false } // Fastest write concern
        });

        // Now update only the current candles for each timeframe
        const candleStats = await updateCurrentCandles(stockUpdates);

        const duration = Date.now() - startTime;
        console.log(`Completed candle aggregation - Updated/created ${candleStats.totalCandles} candles across ${candleStats.timeframes} timeframes in ${duration}ms`);
        return stockUpdates;

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Candle aggregation failed after ${duration}ms:`, error.message);
        throw error;
    }
}

// Efficiently update only the current candle for each timeframe
async function updateCurrentCandles(stockUpdates) {
    const now = new Date();
    const bulkOps = [];
    let candleCount = 0;

    console.log('Processing candle updates for 3 timeframes (5min, 30min, 2hour)');

    for (const update of stockUpdates) {
        const price = update.price || update.currentPrice;
        const stockId = update._id || update.stockId;

        // Calculate current timeframe boundaries (UTC aligned)
        const timeframes = [
            { field: 'candles_5min', minutes: 5 },
            { field: 'candles_30min', minutes: 30 },
            { field: 'candles_2hour', minutes: 120 }
        ];

        for (const tf of timeframes) {
            const { candleStart, candleEnd } = getCandleBoundaries(now, tf.minutes);

            bulkOps.push({
                updateOne: {
                    filter: {
                        _id: stockId,
                        [`${tf.field}.startTime`]: { $ne: candleStart }
                    },
                    update: {
                        $push: {
                            [tf.field]: {
                                $each: [{
                                    startTime: candleStart,
                                    endTime: candleEnd,
                                    open: price,
                                    high: price,
                                    low: price,
                                    close: price,
                                    volume: 1
                                }],
                                $slice: -2000 // Keep last 2000 candles
                            }
                        }
                    }
                }
            });

            // Update existing candle in current timeframe
            bulkOps.push({
                updateOne: {
                    filter: {
                        _id: stockId,
                        [`${tf.field}.startTime`]: candleStart
                    },
                    update: {
                        $set: {
                            [`${tf.field}.$.close`]: price,
                            [`${tf.field}.$.endTime`]: candleEnd
                        },
                        $max: {
                            [`${tf.field}.$.high`]: price
                        },
                        $min: {
                            [`${tf.field}.$.low`]: price
                        },
                        $inc: {
                            [`${tf.field}.$.volume`]: 1
                        }
                    }
                }
            });

            candleCount += 2; // Each stock gets 2 operations per timeframe (create/update)
        }
    }

    if (bulkOps.length > 0) {
        await Stock.bulkWrite(bulkOps, {
            ordered: false,
            writeConcern: { w: 1, j: false }
        });
    }

    return {
        totalCandles: candleCount,
        timeframes: 3
    };
}

// Get UTC-aligned candle boundaries
function getCandleBoundaries(timestamp, intervalMinutes) {
    const ms = timestamp.getTime();
    const intervalMs = intervalMinutes * 60 * 1000;

    // Align to UTC intervals
    const candleStartMs = Math.floor(ms / intervalMs) * intervalMs;
    const candleEndMs = candleStartMs + intervalMs;

    return {
        candleStart: new Date(candleStartMs),
        candleEnd: new Date(candleEndMs)
    };
}

// Alternative approach: Update candles in real-time with each price update
export async function updateCandlesRealTime(stockId, price, timestamp = new Date()) {
    const startTime = Date.now();

    const timeframes = [
        { field: 'candles_5min', minutes: 5 },
        { field: 'candles_30min', minutes: 30 },
        { field: 'candles_2hour', minutes: 120 }
    ];

    const bulkOps = [];

    for (const tf of timeframes) {
        const { candleStart, candleEnd } = getCandleBoundaries(timestamp, tf.minutes);

        // Try to update existing candle first
        bulkOps.push({
            updateOne: {
                filter: {
                    _id: stockId,
                    [tf.field]: {
                        $elemMatch: {
                            startTime: candleStart
                        }
                    }
                },
                update: {
                    $set: {
                        [`${tf.field}.$.close`]: price,
                        [`${tf.field}.$.endTime`]: candleEnd
                    },
                    $max: {
                        [`${tf.field}.$.high`]: price
                    },
                    $min: {
                        [`${tf.field}.$.low`]: price
                    },
                    $inc: {
                        [`${tf.field}.$.volume`]: 1
                    }
                }
            }
        });
    }

    // Execute updates first
    await Stock.bulkWrite(bulkOps, {
        ordered: false,
        writeConcern: { w: 1, j: false }
    });

    // Check if we need to create new candles
    const stock = await Stock.findById(stockId, {
        'candles_5min': { $slice: -1 },
        'candles_30min': { $slice: -1 },
        'candles_2hour': { $slice: -1 }
    });

    const newCandleOps = [];
    let newCandlesCreated = 0;

    for (const tf of timeframes) {
        const { candleStart, candleEnd } = getCandleBoundaries(timestamp, tf.minutes);
        const lastCandle = stock[tf.field]?.[0];

        // Create new candle if it doesn't exist or is from different timeframe
        if (!lastCandle || lastCandle.startTime.getTime() !== candleStart.getTime()) {
            newCandleOps.push({
                updateOne: {
                    filter: { _id: stockId },
                    update: {
                        $push: {
                            [tf.field]: {
                                $each: [{
                                    startTime: candleStart,
                                    endTime: candleEnd,
                                    open: price,
                                    high: price,
                                    low: price,
                                    close: price,
                                    volume: 1
                                }],
                                $slice: -2000 // Keep last 2000 candles
                            }
                        }
                    }
                }
            });
            newCandlesCreated++;
        }
    }

    if (newCandleOps.length > 0) {
        await Stock.bulkWrite(newCandleOps, {
            ordered: false,
            writeConcern: { w: 1, j: false }
        });
    }

    const duration = Date.now() - startTime;
    if (newCandlesCreated > 0)
        console.log(`Completed real-time candle update - ${newCandlesCreated} new candles created in ${duration}ms`);
}

// Backward compatibility
export async function updateCandlesticks(stockId, price, timestamp = new Date()) {
    const startTime = Date.now();

    // Update price history and current price
    await Stock.updateOne(
        { _id: stockId },
        {
            $set: {
                currentPrice: price,
                lastUpdate: timestamp
            },
            $push: {
                priceHistory: {
                    $each: [{ timestamp, price }],
                    $slice: -10000
                }
            }
        }
    );

    // Update candles in real-time
    await updateCandlesRealTime(stockId, price, timestamp);

    const duration = Date.now() - startTime;
}

// Fast read functions (optimized for display) - unchanged
export async function getCandlesForTimeframe(symbol, timeframe, limit = 2000) {
    try {
        console.log(`Fetching ${timeframe} candles for ${symbol} (limit: ${limit})`);

        if (timeframe === '1min') {
            const stock = await Stock.findOne({ symbol }, {
                priceHistory: { $slice: -limit }
            }).lean();

            if (!stock) throw new Error('Stock not found');

            console.log(`Retrieved ${stock.priceHistory?.length || 0} price points for 1min timeframe`);
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

        const stock = await Stock.findOne({ symbol }, {
            [field]: { $slice: -1 },
            currentPrice: 1
        }).lean();

        if (!stock) throw new Error('Stock not found');

        const currentCandle = stock[field]?.[0];
        if (!currentCandle) {
            console.log(`No current candle found for ${symbol} ${timeframe}`);
            return null;
        }

        // Update with current price for real-time display
        return {
            ...currentCandle,
            close: stock.currentPrice || currentCandle.close,
            high: Math.max(currentCandle.high, stock.currentPrice || 0),
            currentPrice: stock.currentPrice
        };

    } catch (error) {
        console.error(`Error getting current ${timeframe} candle for ${symbol}:`, error.message);
        throw error;
    }
}