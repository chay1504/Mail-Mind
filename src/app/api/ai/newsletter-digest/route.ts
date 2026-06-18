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

    const sources = (data || []).map((row: Record<string, unknown>) => ({
      messageId: String(row.gmail_message_id || row.message_id),
      threadId: String(row.gmail_thread_id || row.thread_id),
      subject: String(row.subject || "(No subject)"),
      sender: String(row.sender || "Unknown sender"),
      date: row.sent_at ? String(row.sent_at) : null,
      snippet: row.snippet ? String(row.snippet) : null,
      content: String(row.content || ""),
    }));

    if (!sources.length) {
      return NextResponse.json({
        answer: `No newsletter emails from the past ${days} days were found in the synced inbox. Sync more emails or ask a broader newsletter question.`,
        confidence: "medium",
        sources: [],
      });
    }

    let answer;
    try {
      answer = await answerFromSources({
      question: `List important tech/news items from newsletter emails in the past ${days} days. Deduplicate semantically similar stories, group sources under each unique story, and say if there is not enough newsletter data.`,
        sources,
      });
    } catch {
      answer = buildFastDigest(sources, days);
    }

    return NextResponse.json(answer);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Newsletter digest failed" },
      { status: 500 },
    );
  }
}

function normalizeStoryTitle(subject: string) {
  return subject
    .replace(/^\[[^\]]+\]\s*/g, "")
    .replace(/^(daily|weekly)\s+/i, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 80);
}

function buildFastDigest(
  sources: Array<{
    messageId: string;
    threadId: string;
    subject: string;
    sender: string;
    date: string | null;
    snippet?: string | null;
    content: string;
  }>,
  days: number,
) {
  const groups = new Map<string, typeof sources>();

  for (const source of sources) {
    const key = normalizeStoryTitle(source.subject);
    const existing = groups.get(key) || [];
    existing.push(source);
    groups.set(key, existing);
  }

  const lines = Array.from(groups.values())
    .slice(0, 8)
    .map((group, index) => {
      const primary = group[0];
      const sourceNames = Array.from(new Set(group.map((source) => source.sender))).join(", ");
      const snippet = (primary.snippet || primary.content || "")
        .replace(/\s+/g, " ")
        .slice(0, 180);
      return `${index + 1}. ${primary.subject}\n   Sources: ${sourceNames}\n   ${snippet}`;
    });

  return {
    answer: `Recent newsletter digest for the past ${days} days:\n\n${lines.join("\n\n")}`,
    confidence: "medium",
    sources: sources.slice(0, 8).map((source) => ({
      messageId: source.messageId,
      threadId: source.threadId,
      subject: source.subject,
      sender: source.sender,
      date: source.date,
      snippet: source.snippet,
    })),
  };
}
