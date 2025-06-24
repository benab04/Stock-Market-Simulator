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

        // Build match conditions for orders
        const orderMatchConditions = {
            ...(status && { status: status.toUpperCase() }),
            ...(type && { type: type.toUpperCase() })
        };

        // Build symbol match condition
        const symbolMatchCondition = symbol ? {
            'stockDetails.symbol': {
                $regex: symbol,
                $options: 'i'
            }
        } : {};

        // Main aggregation pipeline with facet to get both data and count efficiently
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
                                ...orderMatchConditions
                            }
                        }
                    ],
                    as: 'orders'
                }
            },
            // Unwind orders array
            {
                $unwind: {
                    path: '$orders',
                    preserveNullAndEmptyArrays: false
                }
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
                $unwind: {
                    path: '$stockDetails',
                    preserveNullAndEmptyArrays: false
                }
            },
            // Match symbol if provided
            ...(Object.keys(symbolMatchCondition).length > 0 ? [{
                $match: symbolMatchCondition
            }] : []),
            // Use facet to get both paginated data and total count
            {
                $facet: {
                    data: [
                        // Project final fields
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
                        // Sort by timestamp (most recent first)
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
                    ],
                    totalCount: [
                        {
                            $count: 'count'
                        }
                    ]
                }
            }
        ];

        // Execute aggregation
        const result = await User.aggregate(pipeline);

        const orders = result[0]?.data || [];
        const total = result[0]?.totalCount[0]?.count || 0;

        // Calculate pagination info
        const pages = Math.ceil(total / limit);

        console.log(`Orders API - Page: ${page}, Total: ${total}, Orders returned: ${orders.length}`);

        return new Response(JSON.stringify({
            orders,
            pagination: {
                total,
                pages,
                currentPage: page,
                perPage: limit
            }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
        });

    } catch (error) {
        console.error('Error fetching orders:', error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}