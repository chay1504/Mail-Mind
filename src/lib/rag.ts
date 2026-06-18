import { getSupabaseAdmin } from "./supabase";
import { embedText } from "./ai";

export async function retrieveEmailSources(question: string, userId: string, limit = 8) {
  const supabase = getSupabaseAdmin();

  try {
    const embedding = await embedText(question);
    const { data, error } = await supabase.rpc("match_email_chunks", {
      query_embedding: embedding,
      match_user_id: userId,
      match_count: limit,
    });

    if (!error && data?.length) return data;
  } catch {
    // Fall back to keyword search when embeddings or the RPC are not configured yet.
  }

  const terms = question
    .split(/\s+/)
    .map((term) => term.replace(/[^a-zA-Z0-9@._-]/g, ""))
    .filter((term) => term.length > 3)
    .slice(0, 5);

  const query = terms.length ? terms.join(" | ") : question;
  const { data, error } = await supabase
    .from("email_chunks")
    .select(
      "message_id, thread_id, subject, sender, sent_at, snippet, content, gmail_message_id, gmail_thread_id",
    )
    .eq("user_id", userId)
    .textSearch("search_document", query, { type: "websearch" })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
