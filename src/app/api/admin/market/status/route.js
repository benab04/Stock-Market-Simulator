import { withAuth } from '@/lib/auth';
import Market from '@/models/Market';
import dbConnect from '@/lib/db';

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export const GET = withAuth(async () => {
    try {
        await dbConnect();

        const market = await Market.findOne({});
        if (!market) {
            return Response.json({ error: 'Market data not found' }, { status: 404 });
        }
        return Response.json({ status: market.status ? 'open' : 'closed' });





    } catch (error) {
        console.error('Error fetching market status:', error);
        return Response.json(
            { error: 'Failed to fetch market status' },
            { status: 500 }
        );
    }
})