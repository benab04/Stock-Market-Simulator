import dbConnect from '@/lib/db';
import Stock from '@/models/Stock';

export async function GET() {
    try {
        await dbConnect();

        // Get all stocks with their basic info
        const stocks = await Stock.find({}, {
            symbol: 1,
            name: 1,
            sector: 1,
            currentPrice: 1,
            previousPrice: 1,
            riskLevel: 1
        });

        return Response.json(stocks);
    } catch (error) {
        console.error('Error fetching stocks:', error);
        return Response.json(
            { error: 'Failed to fetch stocks' },
            { status: 500 }
        );
    }
}
