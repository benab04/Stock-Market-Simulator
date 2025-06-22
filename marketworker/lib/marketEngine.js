import Stock from '../models/Stock.js';
import Order from '../models/Order.js';

// Cache for order aggregations to avoid repeated queries
const orderCache = new Map();
const CACHE_DURATION = 25000; // 25 seconds (refresh before 30s window)

export async function calculateNewPrice(stock, ordersMap = null) {
    let Q = 0;

    // Use pre-aggregated orders if provided, otherwise query individually
    if (ordersMap && ordersMap.has(stock._id.toString())) {
        Q = ordersMap.get(stock._id.toString());
    } else {
        // Fallback to individual query (with caching)
        const cacheKey = stock._id.toString();
        const now = Date.now();

        if (orderCache.has(cacheKey)) {
            const cached = orderCache.get(cacheKey);
            if (now - cached.timestamp < CACHE_DURATION) {
                Q = cached.quantity;
            } else {
                orderCache.delete(cacheKey);
            }
        }

        if (Q === 0 && !orderCache.has(cacheKey)) {
            const thirtySecondsAgo = new Date(Date.now() - 30000);
            const orders = await Order.find({
                stockId: stock._id,
                timestamp: { $gte: thirtySecondsAgo },
                status: 'EXECUTED'
            }).select('type quantity').lean(); // Use lean() for faster queries

            // Calculate Q (net order quantity)
            for (const order of orders) {
                Q += order.type === 'BUY' ? order.quantity : -order.quantity;
            }

            // Cache the result
            orderCache.set(cacheKey, { quantity: Q, timestamp: now });
        }
    }

    // Get volatility factor (V) - use cached value from stock object
    const V = stock.volatilityFactor;

    // Calculate price change using the formula: P(t+1) = P(t) × [1 + 0.02 × tanh(Q/V)]
    const priceChange = 1 + 0.02 * Math.tanh(Q / V);

    const oldPrice = stock.currentPrice;
    const newPrice = oldPrice * priceChange;

    // Apply circuit breaker limits
    const maxChange = 1 + (stock.circuitLimit / 100);
    const minChange = 1 - (stock.circuitLimit / 100);

    let finalPrice = newPrice.toFixed(2);
    if (priceChange > maxChange) finalPrice = oldPrice * maxChange;
    if (priceChange < minChange) finalPrice = oldPrice * minChange;

    return {
        _id: stock._id,
        symbol: stock.symbol,
        price: finalPrice,
        netOrderQuantity: Q,
        previousPrice: oldPrice,
        timestamp: new Date(),
        // Include update data for bulk operation
        updateData: {
            currentPrice: finalPrice,
            previousPrice: oldPrice,
            lastUpdated: new Date()
        }
    };
}

export async function updateAllStockPrices() {
    const startTime = Date.now();

    try {
        // Step 1: Get all stocks with only required fields (faster query)
        const stocks = await Stock.find({})
            .select('symbol currentPrice volatilityFactor circuitLimit')
            .lean(); // Use lean() for 2-3x faster queries

        if (stocks.length === 0) {
            console.log('No stocks found to update');
            return [];
        }

        // Step 2: Pre-aggregate all orders for the last 30 seconds (single query)
        const thirtySecondsAgo = new Date(Date.now() - 30000);
        const orderAggregation = await Order.aggregate([
            {
                $match: {
                    timestamp: { $gte: thirtySecondsAgo },
                    status: 'EXECUTED'
                }
            },
            {
                $group: {
                    _id: '$stockId',
                    netQuantity: {
                        $sum: {
                            $cond: [
                                { $eq: ['$type', 'BUY'] },
                                '$quantity',
                                { $multiply: ['$quantity', -1] }
                            ]
                        }
                    }
                }
            }
        ]);

        // Convert aggregation result to Map for O(1) lookup
        const ordersMap = new Map();
        for (const result of orderAggregation) {
            ordersMap.set(result._id.toString(), result.netQuantity);
        }

        console.log(`Calculating new prices for ${stocks.length} stocks using aggregated orders`);

        // Step 3: Calculate new prices for all stocks (parallel processing)
        const priceCalculations = stocks.map(stock =>
            calculateNewPrice(stock, ordersMap).catch(error => {
                console.error(`Error calculating price for ${stock.symbol}:`, error);
                return null;
            })
        );

        const calculationResults = await Promise.all(priceCalculations);
        const validUpdates = calculationResults.filter(result => result !== null);

        // Step 4: Bulk update all stocks in a single operation
        if (validUpdates.length > 0) {
            const bulkOperations = validUpdates.map(update => ({
                updateOne: {
                    filter: { _id: update._id },
                    update: { $set: update.updateData }
                }
            }));

            await Stock.bulkWrite(bulkOperations, { ordered: false });
        }

        // Step 5: Return updates without the internal updateData
        const updates = validUpdates.map(update => ({
            _id: update._id,
            symbol: update.symbol,
            price: update.price,
            netOrderQuantity: update.netOrderQuantity,
            previousPrice: update.previousPrice,
            timestamp: update.timestamp
        }));

        const totalTime = Date.now() - startTime;
        console.log(`Price calculation completed: ${updates.length} stocks updated in ${totalTime}ms`);

        return updates;

    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error(`Error in updateAllStockPrices after ${totalTime}ms:`, error);
        throw error;
    }
}

// Utility function to clear cache (call this periodically or when needed)
export function clearOrderCache() {
    const clearedCount = orderCache.size;
    orderCache.clear();
    console.log(`Cleared ${clearedCount} cached order aggregations`);
}

// Utility function to get cache stats
export function getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, value] of orderCache.entries()) {
        if (now - value.timestamp < CACHE_DURATION) {
            validEntries++;
        } else {
            expiredEntries++;
        }
    }

    return {
        totalEntries: orderCache.size,
        validEntries,
        expiredEntries,
        cacheDuration: CACHE_DURATION
    };
}