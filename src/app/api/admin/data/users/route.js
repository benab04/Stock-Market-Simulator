import { withAuth } from '@/lib/auth';
import User from '@/models/User';
import dbConnect from '@/lib/db';

export const revalidate = 0;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req) => {
    try {
        await dbConnect();

        // Single optimized aggregation pipeline
        const leaderboard = await User.aggregate([
            // Match non-admin users only
            {
                $match: {
                    $or: [
                        { role: { $ne: 'admin' } },
                        { role: { $exists: false } }
                    ]
                }
            },
            // Lookup stock prices for portfolio calculations
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
            // Add computed fields
            {
                $addFields: {
                    // Create stock price map as object
                    stockPriceMap: {
                        $arrayToObject: {
                            $map: {
                                input: '$stockData',
                                in: {
                                    k: '$$this.symbol',
                                    v: '$$this.currentPrice'
                                }
                            }
                        }
                    },
                    // Calculate total stocks held
                    totalStocks: {
                        $sum: '$portfolio.quantity'
                    }
                }
            },
            // Calculate PnL for each portfolio item and sum
            {
                $addFields: {
                    unrealized_pnl: {
                        $sum: {
                            $map: {
                                input: '$portfolio',
                                as: 'holding',
                                in: {
                                    $subtract: [
                                        // Current value
                                        {
                                            $multiply: [
                                                '$$holding.quantity',
                                                {
                                                    $ifNull: [
                                                        { $getField: { field: '$$holding.stockSymbol', input: '$stockPriceMap' } },
                                                        0
                                                    ]
                                                }
                                            ]
                                        },
                                        // Invested value
                                        {
                                            $ifNull: [
                                                '$$holding.investedValue',
                                                {
                                                    $multiply: ['$$holding.quantity', '$$holding.buyPrice']
                                                }
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            // Calculate total PnL using existing realizedPnL field
            {
                $addFields: {
                    total_pnl: {
                        $add: [
                            { $ifNull: ['$realizedPnL', 0] },
                            '$unrealized_pnl'
                        ]
                    }
                }
            },
            // Sort by total PnL in descending order
            {
                $sort: { total_pnl: -1 }
            },
            // Project only required fields
            {
                $project: {
                    name: 1,
                    email: 1,
                    balance: 1,
                    realized_pnl: { $ifNull: ['$realizedPnL', 0] },
                    unrealized_pnl: { $round: ['$unrealized_pnl', 2] },
                    totalStocks: 1,
                    total_pnl: { $round: ['$total_pnl', 2] }
                }
            }
        ]);

        return Response.json(leaderboard);

    } catch (error) {
        console.error('Leaderboard fetch error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
});

// Optional: Add caching for better performance
export async function HEAD() {
    return new Response(null, {
        status: 200,
        headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30'
        }
    });
}