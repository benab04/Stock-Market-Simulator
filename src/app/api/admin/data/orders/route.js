import { withAuth } from '@/lib/auth';
import Order from '@/models/Order';
import User from '@/models/User';
import Stock from '@/models/Stock';
import dbConnect from '@/lib/db';

export const revalidate = 0;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req) => {
    try {
        await dbConnect();

        // Single optimized aggregation pipeline to get all orders with user and stock data
        const orders = await Order.aggregate([
            // Convert userId to ObjectId if it's a string
            {
                $addFields: {
                    userObjectId: {
                        $cond: {
                            if: { $type: '$userId' },
                            then: {
                                $cond: {
                                    if: { $eq: [{ $type: '$userId' }, 'string'] },
                                    then: { $toObjectId: '$userId' },
                                    else: '$userId'
                                }
                            },
                            else: null
                        }
                    }
                }
            },
            // Lookup user information
            {
                $lookup: {
                    from: 'users',
                    localField: 'userObjectId',
                    foreignField: '_id',
                    as: 'userInfo',
                    pipeline: [
                        {
                            $project: {
                                name: 1,
                                email: 1,
                                role: {
                                    $ifNull: ['$role', 'user']
                                }
                            }
                        }
                    ]
                }
            },
            // Lookup stock information
            {
                $lookup: {
                    from: 'stocks',
                    localField: 'stockId',
                    foreignField: '_id',
                    as: 'stockInfo',
                    pipeline: [
                        {
                            $project: {
                                symbol: 1,
                                name: 1,
                                currentPrice: 1
                            }
                        }
                    ]
                }
            },
            // Unwind arrays (each order should have one user and one stock)
            {
                $unwind: {
                    path: '$userInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $unwind: {
                    path: '$stockInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            // Add computed fields with proper null checks
            {
                $addFields: {
                    totalValue: {
                        $cond: {
                            if: { $and: [{ $type: '$quantity' }, { $type: '$price' }] },
                            then: { $multiply: ['$quantity', '$price'] },
                            else: 0
                        }
                    },
                    // Format timestamp for better readability
                    formattedTimestamp: {
                        $cond: {
                            if: { $type: '$timestamp' },
                            then: {
                                $dateToString: {
                                    format: '%Y-%m-%d %H:%M:%S',
                                    date: '$timestamp'
                                }
                            },
                            else: 'Invalid Date'
                        }
                    }
                }
            },
            // Sort by timestamp in descending order (most recent first)
            {
                $sort: { timestamp: -1 }
            },
            // Project only required fields for the response
            {
                $project: {
                    _id: 1,
                    orderId: { $toString: '$_id' },
                    userName: { $ifNull: ['$userInfo.name', 'Unknown User'] },
                    userEmail: { $ifNull: ['$userInfo.email', 'Unknown Email'] },
                    userRole: { $ifNull: ['$userInfo.role', 'user'] },
                    stockSymbol: { $ifNull: ['$stockInfo.symbol', 'Unknown Symbol'] },
                    companyName: { $ifNull: ['$stockInfo.name', 'Unknown Company'] },
                    currentStockPrice: { $ifNull: ['$stockInfo.currentPrice', 0] },
                    type: 1,
                    quantity: 1,
                    price: 1,
                    totalValue: { $round: ['$totalValue', 2] },
                    status: 1,
                    timestamp: 1,
                    formattedTimestamp: 1,
                    // Calculate profit/loss for executed orders with null safety
                    pnlIndicator: {
                        $cond: {
                            if: {
                                $and: [
                                    { $eq: ['$status', 'EXECUTED'] },
                                    { $type: '$quantity' },
                                    { $type: '$price' }
                                ]
                            },
                            then: {
                                $cond: {
                                    if: { $eq: ['$type', 'SELL'] },
                                    then: {
                                        $round: [
                                            {
                                                $multiply: [
                                                    '$quantity',
                                                    {
                                                        $subtract: [
                                                            '$price',
                                                            { $ifNull: ['$stockInfo.currentPrice', '$price'] }
                                                        ]
                                                    }
                                                ]
                                            },
                                            2
                                        ]
                                    },
                                    else: {
                                        $round: [
                                            {
                                                $multiply: [
                                                    '$quantity',
                                                    {
                                                        $subtract: [
                                                            { $ifNull: ['$stockInfo.currentPrice', '$price'] },
                                                            '$price'
                                                        ]
                                                    }
                                                ]
                                            },
                                            2
                                        ]
                                    }
                                }
                            },
                            else: null
                        }
                    }
                }
            }
        ]);

        // Add summary statistics with null safety
        const summary = await Order.aggregate([
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalBuyOrders: {
                        $sum: { $cond: [{ $eq: ['$type', 'BUY'] }, 1, 0] }
                    },
                    totalSellOrders: {
                        $sum: { $cond: [{ $eq: ['$type', 'SELL'] }, 1, 0] }
                    },
                    executedOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'EXECUTED'] }, 1, 0] }
                    },
                    pendingOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] }
                    },
                    cancelledOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] }
                    },
                    totalVolume: {
                        $sum: {
                            $cond: {
                                if: { $and: [{ $type: '$quantity' }, { $type: '$price' }] },
                                then: { $multiply: ['$quantity', '$price'] },
                                else: 0
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalOrders: 1,
                    totalBuyOrders: 1,
                    totalSellOrders: 1,
                    executedOrders: 1,
                    pendingOrders: 1,
                    cancelledOrders: 1,
                    totalVolume: { $round: ['$totalVolume', 2] }
                }
            }
        ]);

        const response = {
            orders,
            summary: summary[0] || {
                totalOrders: 0,
                totalBuyOrders: 0,
                totalSellOrders: 0,
                executedOrders: 0,
                pendingOrders: 0,
                cancelledOrders: 0,
                totalVolume: 0
            },
            totalCount: orders.length,
            timestamp: new Date().toISOString()
        };
        console.log('Orders fetched successfully:', response);

        return Response.json(response);

    } catch (error) {
        console.error('Orders fetch error:', error);
        return Response.json({
            error: 'Internal server error',
            message: error.message
        }, { status: 500 });
    }
});

// Optional: Add caching for better performance
export async function HEAD() {
    return new Response(null, {
        status: 200,
        headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15'
        }
    });
}