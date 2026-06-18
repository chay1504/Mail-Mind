import { NextRequest, NextResponse } from "next/server";
import { summarizeThread } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const userId =
    request.cookies.get("mailmind_user_id")?.value ||
    request.headers.get("x-mailmind-user-id") ||
    "";

  if (!userId) {
    return NextResponse.json({ error: "User id is required." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const threadId = String(body.threadId || "");

    if (!threadId) {
      return NextResponse.json({ error: "threadId is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: thread, error: threadError } = await supabase
      .from("email_threads")
      .select("id, subject")
      .eq("user_id", userId)
      .eq("id", threadId)
      .single();

    if (threadError) throw threadError;

    const { data: messages, error: messageError } = await supabase
      .from("email_messages")
      .select("sender, sent_at, plain_text")
      .eq("thread_id", thread.id)
      .order("sent_at", { ascending: true });

    if (messageError) throw messageError;

    const result = await summarizeThread({
      subject: thread.subject || "(No subject)",
      messages: (messages || []).map((message) => ({
        sender: message.sender,
        sentAt: message.sent_at,
        body: message.plain_text || "",
      })),
    });

    await supabase
      .from("email_threads")
      .update({
        thread_summary: result.summary,
        category: result.category,
        priority: result.priority,
        key_facts: result.keyFacts,
      })
      .eq("id", thread.id);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 },
    );
  }
}
