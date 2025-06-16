import Stock from '../models/Stock';
import Order from '../models/Order';

export async function calculateNewPrice(stock) {
    const thirtySecondsAgo = new Date(Date.now() - 30000);

    // Get all orders in the last 30 seconds for this stock
    const orders = await Order.find({
        stockId: stock._id,
        timestamp: { $gte: thirtySecondsAgo },
        status: 'EXECUTED'
    });

    // Calculate Q (net order quantity)
    let Q = 0;
    for (const order of orders) {
        Q += order.type === 'BUY' ? order.quantity : -order.quantity;
    }

    // Get volatility factor (V)
    const V = stock.volatilityFactor;

    // Calculate price change using the formula: P(t+1) = P(t) × [1 + 0.02 × tanh(Q/V)]
    const priceChange = 1 + 0.02 * Math.tanh(Q / V);
    const newPrice = stock.currentPrice * priceChange;

    // Apply circuit breaker limits
    const maxChange = 1 + (stock.circuitLimit / 100);
    const minChange = 1 - (stock.circuitLimit / 100);

    let finalPrice = newPrice;
    if (priceChange > maxChange) finalPrice = stock.currentPrice * maxChange;
    if (priceChange < minChange) finalPrice = stock.currentPrice * minChange;

    const timestamp = new Date();

    // Update stock with new price and add to price history
    await Stock.findByIdAndUpdate(stock._id, {
        $set: {
            currentPrice: finalPrice,
            lastUpdated: timestamp
        }
    });

    return {
        _id: stock._id, // Add _id for candlestick aggregation
        symbol: stock.symbol,
        price: finalPrice,
        netOrderQuantity: Q,
        timestamp // Add timestamp for candlestick timestamps
    };
}

export async function updateAllStockPrices() {
    const stocks = await Stock.find({});
    const updates = [];

    for (const stock of stocks) {
        try {
            const update = await calculateNewPrice(stock);
            updates.push(update);
        } catch (error) {
            console.error(`Error updating price for ${stock.symbol}:`, error);
        }
    }

    return updates;
}