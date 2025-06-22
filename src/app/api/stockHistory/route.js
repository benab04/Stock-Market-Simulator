import dbConnect from '@/lib/db';
import Stock from '@/models/Stock';

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET(request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const symbol = searchParams.get('symbol');
        const timeframe = searchParams.get('timeframe') || '5min';
        const start = searchParams.get('start');
        const end = searchParams.get('end');
        // console.log("Fetching historical data for stock:", symbol, "Timeframe:", timeframe, "Start:", start, "End:", end);
        // console.log("Stock", symbol)
        // console.log("Start", start)
        // console.log("End", end)
        if (!symbol) {
            return Response.json(
                { error: 'Symbol parameter is required' },
                { status: 400 }
            );
        }

        // Get the stock with its historical data
        const stock = await Stock.findOne(
            { symbol },
            { symbol: 1, currentPrice: 1, priceHistory: 1 }
        );

        if (!stock) {
            return Response.json(
                { error: 'Stock not found' },
                { status: 404 }
            );
        }

        let candles = [];
        let filteredPriceHistory = stock.priceHistory || [];

        // Filter price history based on time range if provided
        if (start && end) {
            const startTime = new Date(start);
            const endTime = new Date(end);
            filteredPriceHistory = filteredPriceHistory.filter(price =>
                price.timestamp >= startTime && price.timestamp <= endTime
            );
        }

        // Group price history into candles based on timeframe
        if (filteredPriceHistory.length > 0) {
            const interval = timeframe === '5min' ? 5 :
                timeframe === '30min' ? 30 : 120; // 2 hours

            // Sort price history by timestamp
            filteredPriceHistory.sort((a, b) => a.timestamp - b.timestamp);

            // Group into candles
            let currentCandle = null;
            let currentTime = null;

            for (const price of filteredPriceHistory) {
                const time = new Date(price.timestamp);
                const minutes = time.getHours() * 60 + time.getMinutes();
                const candleStart = Math.floor(minutes / interval) * interval;
                const startTime = new Date(time);
                startTime.setHours(Math.floor(candleStart / 60));
                startTime.setMinutes(candleStart % 60);
                startTime.setSeconds(0);
                startTime.setMilliseconds(0);

                if (!currentTime || startTime.getTime() !== currentTime.getTime()) {
                    if (currentCandle) {
                        candles.push(currentCandle);
                    }
                    currentTime = startTime;
                    const endTime = new Date(startTime.getTime() + interval * 60 * 1000);
                    currentCandle = {
                        startTime: startTime.toISOString(),
                        endTime: endTime.toISOString(),
                        open: price.price,
                        high: price.price,
                        low: price.price,
                        close: price.price,
                        volume: 1
                    };
                } else {
                    currentCandle.high = Math.max(currentCandle.high, price.price);
                    currentCandle.low = Math.min(currentCandle.low, price.price);
                    currentCandle.close = price.price;
                    currentCandle.volume += 1;
                }
            }

            if (currentCandle) {
                candles.push(currentCandle);
            }
        }

        return Response.json({
            symbol: stock.symbol,
            currentPrice: stock.currentPrice,
            candles
        });
    } catch (error) {
        console.error('Error fetching historical data:', error);
        return Response.json(
            { error: 'Failed to fetch historical data' },
            { status: 500 }
        );
    }
}