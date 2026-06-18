import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getBaseUrl } from "@/lib/env";
import { getOAuthClient } from "@/lib/google";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("mailmind_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${getBaseUrl()}/?auth=failed`);
  }

  try {
    const oauth = getOAuthClient();
    const tokenResponse = await oauth.getToken(code);
    oauth.setCredentials(tokenResponse.tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth });
    const profile = await oauth2.userinfo.get();
    const email = profile.data.email;

    if (!email) {
      throw new Error("Google profile did not return an email address.");
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error: userError } = await supabase
      .from("user_profiles")
      .upsert(
        {
          email,
          display_name: profile.data.name || email,
          avatar_url: profile.data.picture || null,
        },
        { onConflict: "email" },
      )
      .select("id")
      .single();

    if (userError) throw userError;

    const { error: tokenError } = await supabase.from("gmail_oauth_tokens").upsert(
      {
        user_id: user.id,
        access_token: tokenResponse.tokens.access_token,
        refresh_token: tokenResponse.tokens.refresh_token,
        scope: tokenResponse.tokens.scope,
        token_type: tokenResponse.tokens.token_type,
        expiry_date: tokenResponse.tokens.expiry_date,
      },
      { onConflict: "user_id" },
    );

    if (tokenError) throw tokenError;

    const response = NextResponse.redirect(`${getBaseUrl()}/?auth=connected`);
    response.cookies.set("mailmind_user_id", user.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.delete("mailmind_oauth_state");
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(`${getBaseUrl()}/?auth=failed`);
  }
}
