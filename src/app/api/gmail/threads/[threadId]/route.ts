import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const userId = request.cookies.get("mailmind_user_id")?.value;

  if (!userId) {
    return NextResponse.json({ error: "Connect Gmail first." }, { status: 401 });
  }

  try {
    const { threadId } = await params;
    const supabase = getSupabaseAdmin();
    const { data: messages, error } = await supabase
      .from("email_messages")
      .select("id, gmail_message_id, sender, recipients, sent_at, snippet, plain_text, message_summary")
      .eq("user_id", userId)
      .eq("thread_id", threadId)
      .order("sent_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load messages" },
      { status: 500 },
    );
  }
}
