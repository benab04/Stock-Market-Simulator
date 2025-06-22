import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import User from "@/models/User";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        await dbConnect();

        // Get query parameters for filtering
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const symbol = searchParams.get('symbol');
        const type = searchParams.get('type');
        const page = parseInt(searchParams.get('page')) || 1;
        const limit = parseInt(searchParams.get('limit')) || 10;

        // Build aggregation pipeline starting from User collection
        const pipeline = [
            // Match user by email first
            {
                $match: {
                    email: session.user.email
                }
            },
            // Lookup orders for this user
            {
                $lookup: {
                    from: 'orders',
                    let: { userId: { $toString: '$_id' } },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$userId', '$$userId'] },
                                ...(status && { status: status.toUpperCase() }),
                                ...(type && { type: type.toUpperCase() })
                            }
                        }
                    ],
                    as: 'orders'
                }
            },
            // Unwind orders array
            {
                $unwind: '$orders'
            },
            // Lookup stock details for each order
            {
                $lookup: {
                    from: 'stocks',
                    localField: 'orders.stockId',
                    foreignField: '_id',
                    as: 'stockDetails'
                }
            },
            // Unwind the stockDetails array
            {
                $unwind: '$stockDetails'
            },
            // Match symbol if provided
            ...(symbol ? [{
                $match: {
                    'stockDetails.symbol': {
                        $regex: symbol,
                        $options: 'i'
                    }
                }
            }] : []),
            // Project final fields in the same format as before
            {
                $project: {
                    _id: '$orders._id',
                    symbol: '$stockDetails.symbol',
                    type: { $toLower: '$orders.type' },
                    quantity: '$orders.quantity',
                    price: '$orders.price',
                    timestamp: '$orders.timestamp',
                    status: { $toLower: '$orders.status' },
                    total: { $multiply: ['$orders.quantity', '$orders.price'] }
                }
            },
            // Sort by timestamp
            {
                $sort: { timestamp: -1 }
            },
            // Skip for pagination
            {
                $skip: (page - 1) * limit
            },
            // Limit results
            {
                $limit: limit
            }
        ];

        // Execute aggregation
        const orders = await User.aggregate(pipeline);

        // Get total count for pagination using a separate pipeline
        const countPipeline = [
            // Match user by email first
            {
                $match: {
                    email: session.user.email
                }
            },
            // Lookup orders for this user
            {
                $lookup: {
                    from: 'orders',
                    let: { userId: { $toString: '$_id' } },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$userId', '$$userId'] },
                                ...(status && { status: status.toUpperCase() }),
                                ...(type && { type: type.toUpperCase() })
                            }
                        }
                    ],
                    as: 'orders'
                }
            },
            // Unwind orders array
            {
                $unwind: '$orders'
            },
            // Lookup stock details for each order (needed for symbol filtering)
            {
                $lookup: {
                    from: 'stocks',
                    localField: 'orders.stockId',
                    foreignField: '_id',
                    as: 'stockDetails'
                }
            },
            // Unwind the stockDetails array
            {
                $unwind: '$stockDetails'
            },
            // Match symbol if provided
            ...(symbol ? [{
                $match: {
                    'stockDetails.symbol': {
                        $regex: symbol,
                        $options: 'i'
                    }
                }
            }] : []),
            // Count total documents
            {
                $count: 'total'
            }
        ];

        const totalCount = await User.aggregate(countPipeline);
        const total = totalCount[0]?.total || 0;

        // Debug: Log order count
        console.log('Order count for user:', total);

        return new Response(JSON.stringify({
            orders,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: page,
                perPage: limit
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error fetching orders:', error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}