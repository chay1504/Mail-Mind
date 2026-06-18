import { NextRequest, NextResponse } from "next/server";
import { answerFromSources } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const userId = request.cookies.get("mailmind_user_id")?.value;

  if (!userId) {
    return NextResponse.json({ error: "Connect Gmail first." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(body.days || 4), 1), 14);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("email_chunks")
      .select("message_id, thread_id, gmail_message_id, gmail_thread_id, subject, sender, sent_at, snippet, content, email_threads!inner(category)")
      .eq("user_id", userId)
      .eq("email_threads.category", "Newsletters")
      .gte("sent_at", since)
      .order("sent_at", { ascending: false })
      .limit(30);

    if (error) throw error;

    const answer = await answerFromSources({
      question: `List important tech/news items from newsletter emails in the past ${days} days. Deduplicate semantically similar stories, group sources under each unique story, and say if there is not enough newsletter data.`,
      sources: (data || []).map((row: Record<string, unknown>) => ({
        messageId: String(row.gmail_message_id || row.message_id),
        threadId: String(row.gmail_thread_id || row.thread_id),
        subject: String(row.subject || "(No subject)"),
        sender: String(row.sender || "Unknown sender"),
        date: row.sent_at ? String(row.sent_at) : null,
        snippet: row.snippet ? String(row.snippet) : null,
        content: String(row.content || ""),
      })),
    });

    return NextResponse.json(answer);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Newsletter digest failed" },
      { status: 500 },
    );
  }
}
