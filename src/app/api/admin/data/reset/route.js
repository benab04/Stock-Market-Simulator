import { withAuth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import dotenv from 'dotenv';
import Order from '@/models/Order';
import Stock from '@/models/Stock';
import User from '@/models/User';
dotenv.config();

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export const POST = withAuth(async (req) => {
    try {
        await dbConnect();

        if (!ADMIN_SECRET) {
            return Response.json(
                { error: 'Admin secret is not set' },
                { status: 500 }
            );
        }

        const body = await req.json();
        const { secret } = body;

        const userRole = req.ctx.user.role;

        if (secret !== ADMIN_SECRET) {
            return Response.json(
                { error: 'Invalid admin secret' },
                { status: 403 }
            );
        }

        if (userRole !== 'admin') {
            return Response.json(
                { error: 'You do not have permission to perform this action' },
                { status: 403 }
            );
        }

        // Delete all orders
        const deleteOrdersResult = await Order.deleteMany({});
        console.log(`All orders have been reset. Deleted ${deleteOrdersResult.deletedCount} orders.`);

        // Reset stock data: clear all candles and reset previousPrice
        const resetStocksResult = await Stock.updateMany(
            {},
            {
                $set: {
                    previousPrice: 0,
                    priceHistory: [],
                    candles_5min: [],
                    candles_30min: [],
                    candles_2hour: [],
                    lastCandle_5min: null,
                    lastCandle_30min: null,
                    lastCandle_2hour: null,
                    lastUpdated: new Date()
                }
            }
        );
        console.log(`Reset ${resetStocksResult.modifiedCount} stocks data.`);

        // Reset user data: clear portfolio, reset balance, reset realizedPnL for non-admin users
        const resetUsersResult = await User.updateMany(
            { role: { $ne: 'admin' } }, // Only update non-admin users
            {
                $set: {
                    portfolio: [],
                    balance: 500000000, // 50 Cr (50,00,00,000)
                    realizedPnL: 0
                }
            }
        );
        console.log(`Reset ${resetUsersResult.modifiedCount} user accounts (excluding admins).`);

        return Response.json({
            message: `Successfully completed reset operation`,
            details: {
                ordersDeleted: deleteOrdersResult.deletedCount,
                stocksReset: resetStocksResult.modifiedCount,
                usersReset: resetUsersResult.modifiedCount
            }
        });

    } catch (error) {
        console.error('Error in admin reset operation:', error);
        return Response.json(
            { error: 'Failed to complete reset operation' },
            { status: 500 }
        );
    }
})