import dbConnect from "@/lib/db";
import Avatar from "@/models/Avatar";
import { NextResponse } from "next/server";

export const dynamic = "force-static";

export async function GET() {
    try {
        await dbConnect();
        const avatars = await Avatar.find({});
        return new NextResponse(JSON.stringify(avatars), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            }
        });
    } catch (error) {
        return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}