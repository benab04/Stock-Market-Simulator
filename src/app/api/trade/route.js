import { withAuth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import Stock from '@/models/Stock';
import User from '@/models/User';

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export const POST = withAuth(async (req) => {
    try {
        await dbConnect();

        const { stockSymbol, quantity, type } = await req.json();
        const userId = req.ctx.user.id;

        // Validate request
        if (!stockSymbol || !quantity || !type) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400 }
            );
        }

        // Get stock details
        const stock = await Stock.findOne({ symbol: stockSymbol });
        if (!stock) {
            return new Response(
                JSON.stringify({ error: 'Stock not found' }),
                { status: 404 }
            );
        }

        // Get user
        const user = await User.findById(userId);
        if (!user) {
            return new Response(
                JSON.stringify({ error: 'User not found' }),
                { status: 404 }
            );
        }

        const orderCost = stock.currentPrice * quantity;

        // Validate trade
        if (type === 'BUY') {
            // Check if user has enough balance
            if (user.balance < orderCost) {
                return new Response(
                    JSON.stringify({ error: 'Insufficient balance' }),
                    { status: 400 }
                );
            }
        } else if (type === 'SELL') {
            // Check if user owns enough shares
            const portfolio = user.portfolio.find(p => p.stockSymbol === stockSymbol);
            if (!portfolio || portfolio.quantity < quantity) {
                return new Response(
                    JSON.stringify({ error: 'Insufficient shares' }),
                    { status: 400 }
                );
            }
        }

        // Create order
        const order = await Order.create({
            stockId: stock._id,
            userId,
            type,
            quantity,
            price: stock.currentPrice,
            status: 'EXECUTED',
            timestamp: new Date()
        });

        // Update user's balance and portfolio
        if (type === 'BUY') {
            // Deduct balance
            user.balance -= orderCost;

            // Update portfolio
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
            // Add balance
            user.balance += orderCost;

            // Update portfolio
            const portfolioIndex = user.portfolio.findIndex(p => p.stockSymbol === stockSymbol);
            const currentHolding = user.portfolio[portfolioIndex];
            if (currentHolding.quantity === quantity) {
                user.portfolio.splice(portfolioIndex, 1);
            } else {
                user.portfolio[portfolioIndex].quantity -= quantity;
                user.portfolio[portfolioIndex].investedValue -= currentHolding.investedValue ? orderCost : currentHolding.averagePrice * user.portfolio[portfolioIndex].quantity;
            }
        }

        await user.save();

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
