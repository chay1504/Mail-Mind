import { NextRequest, NextResponse } from "next/server";
import { buildRawEmail, getGmailClient, withBackoff } from "@/lib/gmail";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const userId = request.cookies.get("mailmind_user_id")?.value;

  if (!userId) {
    return NextResponse.json({ error: "Connect Gmail first." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const to = String(body.to || "").trim();
    const subject = String(body.subject || "").trim();
    const messageBody = String(body.body || "").trim();
    const threadId = body.threadId ? String(body.threadId) : "";

    if (!to || !subject || !messageBody) {
      return NextResponse.json({ error: "To, subject, and body are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: token, error: tokenError } = await supabase
      .from("gmail_oauth_tokens")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (tokenError || !token) {
      return NextResponse.json({ error: "Gmail token not found." }, { status: 404 });
    }

    let gmailThreadId: string | undefined;
    let inReplyTo: string | null = null;
    let references: string | null = null;

    if (threadId) {
      const { data: thread } = await supabase
        .from("email_threads")
        .select("gmail_thread_id")
        .eq("user_id", userId)
        .eq("id", threadId)
        .single();

      const { data: latestMessage } = await supabase
        .from("email_messages")
        .select("raw_headers")
        .eq("user_id", userId)
        .eq("thread_id", threadId)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const headers = (latestMessage?.raw_headers || {}) as Record<string, string>;
      gmailThreadId = thread?.gmail_thread_id;
      inReplyTo = headers["message-id"] || null;
      references = [headers.references, headers["message-id"]].filter(Boolean).join(" ") || null;
    }

    const gmail = getGmailClient(token);
    const sent = await withBackoff(() =>
      gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: buildRawEmail({
            to,
            subject,
            body: messageBody,
            inReplyTo,
            references,
          }),
          threadId: gmailThreadId,
        },
      }),
    );

    return NextResponse.json({
      id: sent.data.id,
      threadId: sent.data.threadId,
      status: "sent",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Send failed" },
      { status: 500 },
    );
  }
}
