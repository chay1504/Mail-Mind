import { NextRequest, NextResponse } from "next/server";
import { fetchMessage, getGmailClient, listMessageIds } from "@/lib/gmail";
import { getSupabaseAdmin } from "@/lib/supabase";
import { embedText, summarizeThread } from "@/lib/ai";
import type { EmailCategory } from "@/lib/types";

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
    const maxResults = Math.min(Number(body.maxResults || 20), 100);
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
    const touchedThreadIds = new Set<string>();

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
      touchedThreadIds.add(thread.id);

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
            message_summary: summarizePlainText(message.plainText || message.snippet || ""),
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

    await summarizeRecentlyTouchedThreads(userId, Array.from(touchedThreadIds));

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

function summarizePlainText(text: string) {
  const cleaned = text
    .replace(/\[[^\]]+\]\([^)]+\)/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;
  return cleaned.slice(0, 260);
}

function heuristicCategory(input: string): EmailCategory {
  const text = input.toLowerCase();

  if (/(newsletter|unsubscribe|rundown|ainews|digest|weekly|daily papers|front page of ai)/i.test(text)) {
    return "Newsletters";
  }

  if (/(job|hiring|recruit|internship|application|interview|open jobs|career)/i.test(text)) {
    return "Job / Recruitment";
  }

  if (/(payment|paid|invoice|receipt|bank|upi|₹|rs\.?|refund|credited|debited|famx)/i.test(text)) {
    return "Finance";
  }

  if (/(otp|verification code|sign-in|login|security alert|password|download is ready|notification)/i.test(text)) {
    return "Notifications";
  }

  if (/(meeting|project|team|client|proposal|contract|deadline|workflows|gtc|nvidia)/i.test(text)) {
    return "Work / Professional";
  }

  if (/(hi |hello|thanks|thank you|dear )/i.test(text)) {
    return "Personal";
  }

  return "Other";
}

function heuristicPriority(input: string): "low" | "medium" | "high" {
  const text = input.toLowerCase();
  if (/(urgent|asap|immediately|deadline|security alert|verification code|payment failed)/i.test(text)) {
    return "high";
  }
  if (/(interview|application|invoice|payment|meeting|action required)/i.test(text)) {
    return "medium";
  }
  return "low";
}

function buildFallbackSummary(subject: string, messages: Array<{ sender: string | null; plain_text: string | null }>) {
  const first = messages[0];
  const sender = first?.sender || "Unknown sender";
  const preview = summarizePlainText(messages.map((message) => message.plain_text || "").join(" ")) || "No readable body was extracted.";
  return `${sender} sent ${messages.length} message${messages.length === 1 ? "" : "s"} about "${subject}". ${preview}`;
}

async function summarizeRecentlyTouchedThreads(userId: string, touchedThreadIds: string[]) {
  const supabase = getSupabaseAdmin();
  const baseQuery = supabase.from("email_threads").select("id, subject").eq("user_id", userId);
  const { data: threads } = touchedThreadIds.length
    ? await baseQuery.in("id", touchedThreadIds)
    : await baseQuery.is("thread_summary", null).limit(20);

  for (const [index, thread] of (threads || []).entries()) {
    const { data: messages } = await supabase
      .from("email_messages")
      .select("sender, sent_at, plain_text, subject, snippet")
      .eq("thread_id", thread.id)
      .order("sent_at", { ascending: true });

    if (!messages?.length) continue;

    const subject = thread.subject || messages[0]?.subject || "(No subject)";
    const categoryInput = [subject, ...messages.map((message) => `${message.sender || ""} ${message.snippet || ""} ${message.plain_text || ""}`)]
      .join("\n")
      .slice(0, 6000);

    const fallback = {
      thread_summary: buildFallbackSummary(subject, messages),
      category: heuristicCategory(categoryInput),
      priority: heuristicPriority(categoryInput),
      key_facts: [subject, messages[0]?.sender].filter(Boolean).slice(0, 3),
    };

    await supabase.from("email_threads").update(fallback).eq("id", thread.id);

    if (index > 4) continue;

    try {
      const summary = await summarizeThread({
        subject,
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
      // Heuristic processing above keeps the product usable even if AI quota is temporarily unavailable.
    }
  }
}
