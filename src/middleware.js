import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token
        },
    }
);

// Protect all routes under /dashboard and /api except for auth-related routes
export const config = {
    matcher: [
        "/dashboard/:path*",
        "/api/stockData",
        "/api/stockHistory",
        "/api/orders/:path*"
    ]
}; 