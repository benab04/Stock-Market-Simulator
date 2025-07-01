import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import dbConnect from '@/lib/db';
import User from '@/models/User';

export const revalidate = 0
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();

        // Single aggregation query to get user with populated stock data
        const [userResult] = await User.aggregate([
            {
                $match: { email: session.user.email }
            },
            {
                $lookup: {
                    from: 'stocks',
                    localField: 'portfolio.stockSymbol',
                    foreignField: 'symbol',
                    as: 'stockData',
                    pipeline: [
                        {
                            $project: {
                                symbol: 1,
                                currentPrice: 1
                            }
                        }
                    ]
                }
            },
            {
                $project: {
                    balance: 1,
                    portfolio: 1,
                    stockData: 1,
                    realizedPnL: 1
                }
            }
        ]);

        if (!userResult) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }

        // Handle empty portfolio case
        if (!userResult.portfolio || userResult.portfolio.length === 0) {
            return Response.json({
                summary: {
                    totalInvested: 0,
                    totalCurrent: 0,
                    totalPnL: 0,
                    totalPnLPercentage: 0,
                    realizedPnL: userResult.realizedPnL || 0,
                    availableBalance: userResult.balance,
                    portfolioValue: userResult.balance
                },
                holdings: []
            });
        }

        // Create stock price map for O(1) lookup
        const stockPriceMap = new Map(
            userResult.stockData.map(stock => [stock.symbol, stock.currentPrice])
        );

        // Single pass calculation of all metrics
        let totalInvested = 0;
        let totalCurrent = 0;

        const holdings = userResult.portfolio.map(holding => {
            const currentPrice = stockPriceMap.get(holding.stockSymbol);
            const investedValue = holding.investedValue || (holding.quantity * holding.buyPrice);
            const currentValue = holding.quantity * currentPrice;
            const pnl = currentValue - investedValue;

            // Accumulate totals
            totalInvested += investedValue;
            totalCurrent += currentValue;

            return {
                symbol: holding.stockSymbol,
                quantity: holding.quantity,
                averagePrice: holding.averagePrice,
                buyPrice: holding.buyPrice,
                currentPrice,
                investedValue,
                currentValue,
                pnl,
                pnlPercentage: (pnl / investedValue) * 100
            };
        });

        // Calculate summary metrics
        const totalPnL = totalCurrent - totalInvested;
        const portfolioValue = totalCurrent + userResult.balance;

        const portfolioSummary = {
            totalInvested,
            totalCurrent,
            totalPnL,
            totalPnLPercentage: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0,
            availableBalance: userResult.balance,
            realizedPnL: userResult.realizedPnL || 0,
            portfolioValue
        };

        // Add portfolio allocation and sort in single pass
        const holdingsWithAllocation = holdings
            .map(holding => ({
                ...holding,
                portfolioPercentage: holding.investedValue
                    ? (holding.investedValue / totalInvested) * 100
                    : (holding.currentValue / portfolioValue) * 100
            }))
            .sort((a, b) => b.currentValue - a.currentValue);

        return Response.json({
            summary: portfolioSummary,
            holdings: holdingsWithAllocation
        });

    } catch (error) {
        console.error('Portfolio fetch error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}