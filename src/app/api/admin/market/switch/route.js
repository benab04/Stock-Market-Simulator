import { withAuth } from '@/lib/auth';
import User from '@/models/User';
import Market from '@/models/Market';
import dbConnect from '@/lib/db';
import dotenv from 'dotenv';
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
        const { secret, state } = body;

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

        const market = await Market.findOne();
        if (!market) {
            return Response.json({ error: 'Market data not found' }, { status: 404 });
        }

        market.status = state === 'open';
        await market.save();

        console.log(`Market status has been switched to ${state}.`);

        return Response.json({ message: "Successfully updated" });

    } catch (error) {
        console.error('Error authenticating admin:', error);
        return Response.json(
            { error: 'Failed to authenticate admin' },
            { status: 500 }
        );
    }
})