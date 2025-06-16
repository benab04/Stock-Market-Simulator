import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import dbConnect from "@/lib/db";
import User from "@/models/User";

export const authOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                try {
                    await dbConnect();

                    // Find user and explicitly select password field
                    const user = await User.findOne({ email: credentials.email }).select('+password');

                    if (!user) {
                        throw new Error('No user found with this email');
                    }

                    const isValid = await user.comparePassword(credentials.password);

                    if (!isValid) {
                        throw new Error('Invalid password');
                    }

                    // Return user without password
                    return {
                        id: user._id.toString(),
                        email: user.email,
                        name: user.name
                    };
                } catch (error) {
                    throw new Error(error.message);
                }
            }
        })
    ],
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (token) {
                session.user.id = token.id;
            }
            return session;
        }
    },
    pages: {
        signIn: '/login',
        error: '/login',
    },
    secret: process.env.NEXTAUTH_SECRET
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 