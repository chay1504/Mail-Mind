import { NextRequest, NextResponse } from "next/server";
import { answerFromSources } from "@/lib/ai";
import { retrieveEmailSources } from "@/lib/rag";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { EmailCategory } from "@/lib/types";

export async function POST(request: NextRequest) {
  const userId = request.cookies.get("mailmind_user_id")?.value;

  if (!userId) {
    return NextResponse.json({ error: "Connect Gmail first." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const question = String(body.question || "").trim();

    if (!question) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }

    const rows = await retrieveEmailSources(question, userId, 10);
    const categoryRows = await retrieveCategorySources(question, userId);
    const seen = new Set<string>();
    const mergedRows = [...categoryRows, ...rows].filter((row: Record<string, unknown>) => {
      const key = String(row.gmail_message_id || row.message_id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const answer = await answerFromSources({
      question,
      conversation: body.conversation || [],
      sources: mergedRows.map((row: Record<string, unknown>) => ({
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
      { error: error instanceof Error ? error.message : "Chat failed" },
      { status: 500 },
    );
  }
}

function detectCategory(question: string): EmailCategory | null {
  const text = question.toLowerCase();
  if (/(newsletter|digest|news)/.test(text)) return "Newsletters";
  if (/(job|recruit|application|interview|company|rejected|hiring)/.test(text)) return "Job / Recruitment";
  if (/(payment|invoice|receipt|bank|finance|money|paid)/.test(text)) return "Finance";
  if (/(notification|otp|verification|sign-in|login|alert)/.test(text)) return "Notifications";
  if (/(work|professional|project|team|client)/.test(text)) return "Work / Professional";
  if (/(personal|friend|family)/.test(text)) return "Personal";
  return null;
}

async function retrieveCategorySources(question: string, userId: string) {
  const category = detectCategory(question);
  if (!category) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("email_chunks")
    .select("message_id, thread_id, gmail_message_id, gmail_thread_id, subject, sender, sent_at, snippet, content, email_threads!inner(category)")
    .eq("user_id", userId)
    .eq("email_threads.category", category)
    .order("sent_at", { ascending: false })
    .limit(10);

  if (error) return [];
  return data || [];
}
