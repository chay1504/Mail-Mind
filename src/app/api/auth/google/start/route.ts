import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getGoogleAuthUrl } from "@/lib/google";

export async function GET() {
  try {
    const state = randomUUID();
    const response = NextResponse.redirect(getGoogleAuthUrl(state));
    response.cookies.set("mailmind_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OAuth start failed" },
      { status: 500 },
    );
  }
}
