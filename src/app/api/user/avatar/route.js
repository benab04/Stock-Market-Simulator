import dbConnect from '@/lib/db';
import User from '@/models/User';
import Avatar from '@/models/Avatar';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// Response helper for consistent JSON responses
const jsonResponse = (data, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });

export const GET = async () => {
    try {
        // Early session validation
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        await dbConnect();

        // Single optimized query with population
        const user = await User.findOne(
            { email: session.user.email },
            { avatarId: 1, _id: 0 } // Only select avatarId field
        ).populate({
            path: 'avatarId',
            select: 'image', // Only select image field from Avatar
            model: Avatar
        }).lean(); // Use lean() for better performance

        // Handle user not found
        if (!user) {
            return jsonResponse({ error: 'User not found' }, 404);
        }

        // Handle avatar not found
        if (!user.avatarId?.image) {
            return jsonResponse({ error: 'Avatar not found' }, 404);
        }

        return jsonResponse({ avatar: user.avatarId.image });

    } catch (error) {
        console.error('Error fetching avatar:', error);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
};