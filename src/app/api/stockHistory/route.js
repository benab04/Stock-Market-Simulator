import dbConnect from '@/lib/db';
import Stock from '@/models/Stock';

export async function GET() {
    try {
        await dbConnect();

        // Get all stocks with their latest 20 price history entries
        const stocks = await Stock.aggregate([
            {
                $project: {
                    symbol: 1,
                    currentPrice: 1,
                    priceHistory: {
                        $slice: ['$priceHistory', -20] // Get last 20 entries
                    }
                }
            }
        ]);

        // Format the response
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