import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Middleware to check if user is authenticated
export async function getAuthSession() {
    const session = await getServerSession(authOptions);
    return session;
}

// Helper to get current user from session
export async function getCurrentUser() {
    try {
        const session = await getAuthSession();
        return session?.user;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

// Middleware to protect API routes
export async function withAuth(handler) {
    return async (req, res) => {
        try {
            const session = await getAuthSession();

            if (!session) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            // Add user to the request object
            req.user = session.user;
            return handler(req, res);
        } catch (error) {
            console.error('Auth middleware error:', error);
            return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    };
} 