import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Stock from '@/models/Stock';

export const revalidate = 0
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();

        const symbol = params.symbol;
        if (!symbol) {
            return Response.json({ error: 'Missing symbol parameter' }, { status: 400 });
        }

        // Get user
        const user = await User.findOne({ email: session.user.email });
        if (!user) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }

        // Find the holding for the specific stock
        const holding = user.portfolio.find(item => item.stockSymbol === symbol);
        if (!holding) {
            return Response.json({ error: 'Stock not found in portfolio' }, { status: 404 });
        }

        // Get current price
        const stock = await Stock.findOne({ symbol });
        if (!stock) {
            return Response.json({ error: 'Stock not found' }, { status: 404 });
        }

        const investedValue = holding.quantity * holding.buyPrice;
        const currentValue = holding.quantity * stock.currentPrice;

        const holdingDetails = {
            symbol: holding.stockSymbol,
            quantity: holding.quantity,
            averagePrice: holding.averagePrice,
            buyPrice: holding.buyPrice,
            currentPrice: stock.currentPrice,
            investedValue: investedValue,
            currentValue: currentValue,
            pnl: currentValue - investedValue,
            pnlPercentage: ((currentValue - investedValue) / investedValue) * 100
        };

        return Response.json({ holding: holdingDetails });

    } catch (error) {
        console.error('Portfolio fetch error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}