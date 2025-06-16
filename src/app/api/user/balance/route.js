import { withAuth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import User from '@/models/User';

export const GET = withAuth(async (req) => {
    try {
        await dbConnect();

        console.log('Fetching user balance...');
        const userId = req.ctx.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return new Response(
                JSON.stringify({ error: 'User not found' }),
                { status: 404 }
            );
        }

        return new Response(
            JSON.stringify({ balance: user.balance }),
            { status: 200 }
        );
    } catch (error) {
        console.error('Error fetching balance:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500 }
        );
    }
});
