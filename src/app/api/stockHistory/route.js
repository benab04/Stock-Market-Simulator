import dbConnect from '@/lib/db';
import Stock from '@/models/Stock';

export async function GET(request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const timeframe = searchParams.get('timeframe') || '1min';

        // Convert timeframe to number of entries
        const entriesMap = {
            '1min': 20,
            '5min': 100,
            '30min': 300,
            '1hr': 600
        };

        const numEntries = entriesMap[timeframe] || 20;

        // Get stocks with their historical entries based on timeframe
        const stocks = await Stock.aggregate([
            {
                $project: {
                    symbol: 1,
                    currentPrice: 1,
                    priceHistory: {
                        $slice: ['$priceHistory', -numEntries]
                    }
                }
            }
        ]);

        // Format and aggregate the data based on timeframe
        const formattedData = stocks.map(stock => {
            let aggregatedHistory = stock.priceHistory || [];

            if (timeframe !== '1min') {
                // Group data points based on timeframe
                const groupSize = timeframe === '5min' ? 5 : timeframe === '30min' ? 30 : 60;
                const groups = [];

                for (let i = 0; i < aggregatedHistory.length; i += groupSize) {
                    const group = aggregatedHistory.slice(i, i + groupSize);
                    if (group.length > 0) {
                        groups.push({
                            timestamp: group[0].timestamp,
                            open: group[0].open,
                            high: Math.max(...group.map(g => g.high)),
                            low: Math.min(...group.map(g => g.low)),
                            close: group[group.length - 1].close,
                            volume: group.reduce((sum, g) => sum + g.volume, 0)
                        });
                    }
                }
                aggregatedHistory = groups;
            }

            return {
                symbol: stock.symbol,
                currentPrice: stock.currentPrice,
                priceHistory: aggregatedHistory
            };
        });

        return Response.json(formattedData);
    } catch (error) {
        console.error('Error fetching historical data:', error);
        return Response.json(
            { error: 'Failed to fetch historical data' },
            { status: 500 }
        );
    }
} 