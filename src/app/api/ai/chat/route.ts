import { NextRequest, NextResponse } from "next/server";
import { answerFromSources } from "@/lib/ai";
import { retrieveEmailSources } from "@/lib/rag";

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
    const answer = await answerFromSources({
      question,
      conversation: body.conversation || [],
      sources: rows.map((row: Record<string, unknown>) => ({
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
