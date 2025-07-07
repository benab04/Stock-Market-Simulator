import { withAuth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import Stock from '@/models/Stock';
import User from '@/models/User';
import Market from '@/models/Market';

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export const POST = withAuth(async (req) => {
    try {
        await dbConnect();

        const market = await Market.findOne({});

        const { stockSymbol, quantity, type } = await req.json();
        const userId = req.ctx.user.id;

        if (req.ctx.user.role !== 'admin' && !market.status) {
            return new Response(
                JSON.stringify({ error: 'Market is closed' }),
                { status: 403 }
            );
        }

        // Validate request
        if (!stockSymbol || !quantity || !type) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400 }
            );
        }

        // Parallel fetch of stock and user data
        const [stock, user] = await Promise.all([
            Stock.findOne({ symbol: stockSymbol }).lean(),
            User.findById(userId)
        ]);

        if (!stock) {
            return new Response(
                JSON.stringify({ error: 'Stock not found' }),
                { status: 404 }
            );
        }

        if (!user) {
            return new Response(
                JSON.stringify({ error: 'User not found' }),
                { status: 404 }
            );
        }

        if (user.status && user.status === 'INACTIVE') {
            return new Response(
                JSON.stringify({ error: 'You have been disqualified. Please contact admin.' }),
                { status: 403 }
            );
        }

        const orderCost = stock.currentPrice * quantity;

        // Validate trade
        if (!req.ctx.user.role || req.ctx.user.role === 'user') {
            if (type === 'BUY') {
                if (user.balance < orderCost) {
                    user.status = 'INACTIVE';
                    await user.save();
                    return new Response(
                        JSON.stringify({ error: 'Insufficient balance. You have been disqualified. Please contact admin.' }),
                        { status: 400 }
                    );
                }
            } else if (type === 'SELL') {
                const portfolio = user.portfolio.find(p => p.stockSymbol === stockSymbol);
                if (!portfolio || portfolio.quantity < quantity) {
                    return new Response(
                        JSON.stringify({ error: 'Insufficient shares' }),
                        { status: 400 }
                    );
                }
            }
        }

        // Create order
        const orderPromise = Order.create({
            stockId: stock._id,
            userId,
            type,
            quantity,
            price: stock.currentPrice,
            status: 'EXECUTED',
            timestamp: new Date()
        });

        // Update user portfolio and balance
        if (type === 'BUY') {
            if (!req.ctx.user.role || req.ctx.user.role === 'user') {
                user.balance -= orderCost;
            }

            const portfolioIndex = user.portfolio.findIndex(p => p.stockSymbol === stockSymbol);
            if (portfolioIndex === -1) {
                user.portfolio.push({
                    stockSymbol,
                    quantity,
                    averagePrice: stock.currentPrice,
                    buyPrice: stock.currentPrice,
                    investedValue: orderCost,
                });
            } else {
                const currentHolding = user.portfolio[portfolioIndex];
                const totalShares = currentHolding.quantity + quantity;
                const totalCost = (currentHolding.quantity * currentHolding.averagePrice) + orderCost;
                user.portfolio[portfolioIndex].quantity = totalShares;
                user.portfolio[portfolioIndex].investedValue = currentHolding.investedValue ? currentHolding.investedValue + orderCost : totalCost;
                user.portfolio[portfolioIndex].averagePrice = totalCost / totalShares;
                user.portfolio[portfolioIndex].buyPrice = stock.currentPrice;
            }
        } else {
            if (!req.ctx.user.role || req.ctx.user.role === 'user') {
                user.balance += orderCost;
            }

            const portfolioIndex = user.portfolio.findIndex(p => p.stockSymbol === stockSymbol);
            const currentHolding = user.portfolio[portfolioIndex];

            if (!req.ctx.user.role || req.ctx.user.role === 'user') {
                // Initialize realizedPnL if it doesn't exist
                if (!user.realizedPnL) {
                    user.realizedPnL = 0;
                }
                // Calculate and add the realized PnL for this sell transaction
                const realizedGainLoss = (stock.currentPrice - currentHolding.averagePrice) * quantity;
                console.log(`Real ${realizedGainLoss}`);

                user.realizedPnL += realizedGainLoss;

                // Mark the field as modified to ensure it gets saved
                user.markModified('realizedPnL');
            }

            if (currentHolding.quantity === quantity) {
                user.portfolio.splice(portfolioIndex, 1);
            } else {
                user.portfolio[portfolioIndex].quantity -= quantity;
                user.portfolio[portfolioIndex].investedValue -= currentHolding.investedValue ? orderCost : currentHolding.averagePrice * quantity;
            }
        }

        // Execute both operations in parallel
        const [order] = await Promise.all([
            orderPromise,
            user.save()
        ]);

        return new Response(
            JSON.stringify({
                message: 'Trade executed successfully',
                order,
                newBalance: user.balance
            }),
            { status: 200 }
        );
    } catch (error) {
        console.error('Trade error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500 }
        );
    }
});