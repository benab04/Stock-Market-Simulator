import dbConnect from '@/lib/db';
import Stock from '@/models/Stock';

export async function GET(request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const timeframe = searchParams.get('timeframe') || '1min';

        // Calculate time window for filtering data
        const now = new Date();
        const timeWindow = {
            '1min': 60 * 1000,            // 1 minute in milliseconds
            '5min': 5 * 60 * 1000,        // 5 minutes
            '30min': 30 * 60 * 1000,      // 30 minutes
            '1hr': 60 * 60 * 1000         // 1 hour
        }[timeframe] || 60 * 1000;        // default to 1 min

        const startTime = new Date(now.getTime() - timeWindow);

        // Get stocks with their historical entries based on timeframe
        const stocks = await Stock.aggregate([
            {
                $project: {
                    symbol: 1,
                    currentPrice: 1,
                    priceHistory: {
                        $filter: {
                            input: '$priceHistory',
                            as: 'item',
                            cond: { $gte: ['$$item.timestamp', startTime] }
                        }
                    }
                }
            }
        ]);

        // Format the data without time-based aggregation
        const formattedData = stocks.map(stock => ({
            symbol: stock.symbol,
            currentPrice: stock.currentPrice,
            priceHistory: stock.priceHistory || []
        }));

        return Response.json(formattedData);
    } catch (error) {
        console.error('Error fetching historical data:', error);
        return Response.json(
            { error: 'Failed to fetch historical data' },
            { status: 500 }
        );
    }
}