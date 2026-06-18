import { NextRequest, NextResponse } from "next/server";
import { draftEmail } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const userId = request.cookies.get("mailmind_user_id")?.value;

  if (!userId) {
    return NextResponse.json({ error: "Connect Gmail first." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const mode = body.mode === "reply" ? "reply" : "compose";
    const prompt = String(body.prompt || "").trim();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    let thread:
      | Array<{ sender: string | null; sentAt: string | null; body: string }>
      | undefined;
    let subject: string | null | undefined = body.subject;

    if (mode === "reply" && body.threadId) {
      const supabase = getSupabaseAdmin();
      const { data: messages, error } = await supabase
        .from("email_messages")
        .select("sender, sent_at, plain_text, subject")
        .eq("user_id", userId)
        .eq("thread_id", body.threadId)
        .order("sent_at", { ascending: true });

      if (error) throw error;

      thread = (messages || []).map((message) => ({
        sender: message.sender,
        sentAt: message.sent_at,
        body: message.plain_text || "",
      }));
      subject = subject || messages?.[0]?.subject;
    }

    const draft = await draftEmail({ mode, prompt, thread, subject });
    return NextResponse.json(draft);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Draft failed" },
      { status: 500 },
    );
  }
}
