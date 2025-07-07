import dbConnect from "@/lib/db";
import User from "@/models/User";
import dotenv from 'dotenv';
dotenv.config();

export async function POST(req) {
    try {
        await dbConnect();

        const REGISTER_ALLOWED = process.env.REGISTER_ALLOWED || 'true';

        const body = await req.json();
        const { name, email, password, avatarId } = body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return new Response(
                JSON.stringify({ error: 'User with this email already exists' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (REGISTER_ALLOWED.toLowerCase() !== 'true') {
            return new Response(
                JSON.stringify({ error: 'Registration is currently closed' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
        }



        // Create new user
        const user = await User.create({
            name,
            email,
            password,
            avatarId,
            balance: 500000000, // Starting balance ₹50,00,00,000
            portfolio: []
        });

        // Remove password from response
        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            balance: user.balance,
            avatarId: user.avatarId,
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