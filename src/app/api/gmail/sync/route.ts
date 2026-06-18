import { NextRequest, NextResponse } from "next/server";
import { fetchMessage, getGmailClient, listMessageIds } from "@/lib/gmail";
import { getSupabaseAdmin } from "@/lib/supabase";
import { embedText, summarizeThread } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const userId =
    request.cookies.get("mailmind_user_id")?.value ||
    request.headers.get("x-mailmind-user-id") ||
    "";

  if (!userId) {
    return NextResponse.json({ error: "Connect Gmail first." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const maxResults = Math.min(Number(body.maxResults || 50), 300);
    const pageToken = body.pageToken as string | undefined;
    const query = (body.query as string | undefined) || "newer_than:90d";
    const supabase = getSupabaseAdmin();

    const { data: token, error: tokenError } = await supabase
      .from("gmail_oauth_tokens")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (tokenError || !token) {
      return NextResponse.json({ error: "Gmail token not found." }, { status: 404 });
    }

    const gmail = getGmailClient(token);
    const listed = await listMessageIds(gmail, { maxResults, pageToken, query });
    const messages = [];

    for (const messageId of listed.ids) {
      const message = await fetchMessage(gmail, messageId);
      messages.push(message);

      const { data: thread, error: threadError } = await supabase
        .from("email_threads")
        .upsert(
          {
            user_id: userId,
            gmail_thread_id: message.gmailThreadId,
            subject: message.subject,
            last_message_at: message.sentAt,
          },
          { onConflict: "user_id,gmail_thread_id" },
        )
        .select("id")
        .single();

      if (threadError) throw threadError;

      const { data: dbMessage, error: messageError } = await supabase
        .from("email_messages")
        .upsert(
          {
            user_id: userId,
            thread_id: thread.id,
            gmail_message_id: message.gmailMessageId,
            gmail_thread_id: message.gmailThreadId,
            history_id: message.historyId,
            label_ids: message.labelIds,
            subject: message.subject,
            sender: message.sender,
            recipients: message.recipients,
            sent_at: message.sentAt,
            snippet: message.snippet,
            plain_text: message.plainText,
            html_text: message.htmlText,
            raw_headers: message.headers,
          },
          { onConflict: "user_id,gmail_message_id" },
        )
        .select("id")
        .single();

      if (messageError) throw messageError;

      const chunkText = [message.subject, message.sender, message.sentAt, message.plainText]
        .filter(Boolean)
        .join("\n");

      let embedding: number[] | null = null;
      try {
        embedding = await embedText(chunkText);
      } catch {
        embedding = null;
      }

      const { error: chunkError } = await supabase.from("email_chunks").upsert(
        {
          user_id: userId,
          message_id: dbMessage.id,
          thread_id: thread.id,
          gmail_message_id: message.gmailMessageId,
          gmail_thread_id: message.gmailThreadId,
          subject: message.subject,
          sender: message.sender,
          sent_at: message.sentAt,
          snippet: message.snippet,
          content: chunkText.slice(0, 12000),
          embedding,
        },
        { onConflict: "message_id" },
      );

      if (chunkError) throw chunkError;
    }

    await summarizeRecentlyTouchedThreads(userId);

    return NextResponse.json({
      synced: messages.length,
      nextPageToken: listed.nextPageToken,
      resultSizeEstimate: listed.resultSizeEstimate,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 },
    );
  }
}

async function summarizeRecentlyTouchedThreads(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data: threads } = await supabase
    .from("email_threads")
    .select("id, subject")
    .eq("user_id", userId)
    .is("thread_summary", null)
    .limit(8);

  for (const thread of threads || []) {
    const { data: messages } = await supabase
      .from("email_messages")
      .select("sender, sent_at, plain_text")
      .eq("thread_id", thread.id)
      .order("sent_at", { ascending: true });

    if (!messages?.length) continue;

    try {
      const summary = await summarizeThread({
        subject: thread.subject || "(No subject)",
        messages: messages.map((message) => ({
          sender: message.sender,
          sentAt: message.sent_at,
          body: message.plain_text || "",
        })),
      });

      await supabase
        .from("email_threads")
        .update({
          thread_summary: summary.summary,
          category: summary.category,
          priority: summary.priority,
          key_facts: summary.keyFacts,
        })
        .eq("id", thread.id);
    } catch {
      // Keep sync successful even if AI quota is temporarily unavailable.
    }
  }
}
