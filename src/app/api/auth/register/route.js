import dbConnect from "@/lib/db";
import User from "@/models/User";

export async function POST(req) {
    try {
        await dbConnect();

        const body = await req.json();
        const { name, email, password } = body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return new Response(
                JSON.stringify({ error: 'User with this email already exists' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Create new user
        const user = await User.create({
            name,
            email,
            password,
            balance: 100000, // Starting balance ₹100,000
            portfolio: []
        });

        // Remove password from response
        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            balance: user.balance
        };

        return new Response(
            JSON.stringify({ message: 'User registered successfully', user: userResponse }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Registration error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
} 