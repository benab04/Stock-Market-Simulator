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
        const { secret } = body;

        const userRole = req.ctx.user.role;



        if (secret !== ADMIN_SECRET) {
            return Response.json(
                { error: 'Invalid admin secret' },
                { status: 403 }
            );
        }

        if (!userRole || userRole !== 'admin') {
            const user = await User.findById(req.ctx.user.id);
            user.role = 'admin';
            await user.save();

            const market = await Market.findOne();
            if (!market) {
                return Response.json({ error: 'Market data not found' }, { status: 404 });
            }

            // Ensure user is added to admin list if not already present
            const alreadyAdmin = market.admin.some(id => id.equals(user._id));
            if (!alreadyAdmin) {
                market.admin.push(user._id);
                await market.save();
            }

            console.log(`User ${user.email} has been granted admin privileges.`);
        }


        return Response.json({ message: "Successfully authenticated" });

    } catch (error) {
        console.error('Error authenticating admin:', error);
        return Response.json(
            { error: 'Failed to authenticate admin' },
            { status: 500 }
        );
    }
})