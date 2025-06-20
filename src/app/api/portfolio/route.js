import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Stock from '@/models/Stock';

export const revalidate = 0
export const runtime = 'nodejs'

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();

        // Get user's portfolio and balance
        const user = await User.findOne({ email: session.user.email });
        if (!user) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }

        // Handle empty portfolio case
        if (!user.portfolio || user.portfolio.length === 0) {
            return Response.json({
                summary: {
                    totalInvested: 0,
                    totalCurrent: 0,
                    totalPnL: 0,
                    totalPnLPercentage: 0,
                    availableBalance: user.balance,
                    portfolioValue: user.balance
                },
                holdings: []
            });
        }

        // Get current stock prices
        const stockSymbols = user.portfolio.map(item => item.stockSymbol);
        const stocks = await Stock.find({ symbol: { $in: stockSymbols } });

        // Create a map for quick stock price lookup
        const stockPriceMap = new Map(stocks.map(stock => [stock.symbol, stock.currentPrice]));

        // Calculate portfolio metrics
        let totalInvested = 0;
        let totalCurrent = 0;

        const holdings = user.portfolio.map(holding => {
            const currentPrice = stockPriceMap.get(holding.stockSymbol);
            const investedValue = holding.buyPrice ? holding.quantity * holding.buyPrice : holding.quantity * holding.averagePrice;
            const currentValue = holding.quantity * currentPrice;

            totalInvested += investedValue;
            totalCurrent += currentValue;

            return {
                symbol: holding.stockSymbol,
                quantity: holding.quantity,
                averagePrice: holding.averagePrice,
                currentPrice: currentPrice,
                investedValue: investedValue,
                currentValue: currentValue,
                pnl: currentValue - investedValue,
                pnlPercentage: ((currentValue - investedValue) / investedValue) * 100
            };
        });

        // Calculate portfolio summary
        const portfolioSummary = {
            totalInvested,
            totalCurrent,
            totalPnL: totalCurrent - totalInvested,
            totalPnLPercentage: totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0,
            availableBalance: user.balance,
            portfolioValue: totalCurrent + user.balance
        };

        // Calculate percentage allocation
        const holdingsWithAllocation = holdings.map(holding => ({
            ...holding,
            portfolioPercentage: (holding.currentValue / portfolioSummary.portfolioValue) * 100
        }));

        // Sort holdings by current value (descending)
        holdingsWithAllocation.sort((a, b) => b.currentValue - a.currentValue);

        return Response.json({
            summary: portfolioSummary,
            holdings: holdingsWithAllocation
        });

    } catch (error) {
        console.error('Portfolio fetch error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}


export const dynamic = 'force-dynamic'
