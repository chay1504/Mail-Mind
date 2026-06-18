import { gmail_v1, google } from "googleapis";
import { getOAuthClient } from "./google";

type Header = { name?: string | null; value?: string | null };

export type NormalizedMessage = {
  gmailMessageId: string;
  gmailThreadId: string;
  historyId: string | null;
  labelIds: string[];
  subject: string | null;
  sender: string | null;
  recipients: string[];
  sentAt: string | null;
  snippet: string | null;
  plainText: string;
  htmlText: string | null;
  internalDate: string | null;
  headers: Record<string, string>;
};

export function getGmailClient(tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
}) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(tokens);
  return google.gmail({ version: "v1", auth: oauth2Client });
}

export async function withBackoff<T>(operation: () => Promise<T>, attempts = 4) {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const status = (error as { code?: number; response?: { status?: number } }).code ||
        (error as { response?: { status?: number } }).response?.status;

      if (![429, 500, 502, 503, 504].includes(Number(status))) {
        throw error;
      }

      const delay = Math.min(8000, 500 * 2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export function decodeBase64Url(data?: string | null) {
  if (!data) return "";

  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function headersToMap(headers: Header[] = []) {
  return headers.reduce<Record<string, string>>((acc, header) => {
    if (header.name && header.value) {
      acc[header.name.toLowerCase()] = header.value;
    }
    return acc;
  }, {});
}

function collectBodyParts(part?: gmail_v1.Schema$MessagePart): {
  plain: string[];
  html: string[];
} {
  if (!part) return { plain: [], html: [] };

  const childBodies = (part.parts || []).map(collectBodyParts);
  const plain = childBodies.flatMap((body) => body.plain);
  const html = childBodies.flatMap((body) => body.html);
  const text = decodeBase64Url(part.body?.data);

  if (part.mimeType === "text/plain" && text) {
    plain.push(text);
  }

  if (part.mimeType === "text/html" && text) {
    html.push(text);
  }

  return { plain, html };
}

export function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeGmailMessage(
  message: gmail_v1.Schema$Message,
): NormalizedMessage {
  const payload = message.payload;
  const headerMap = headersToMap(payload?.headers || []);
  const body = collectBodyParts(payload || undefined);
  const html = body.html.join("\n\n") || null;
  const plain = body.plain.join("\n\n") || (html ? stripHtml(html) : "");

  return {
    gmailMessageId: message.id || "",
    gmailThreadId: message.threadId || "",
    historyId: message.historyId || null,
    labelIds: message.labelIds || [],
    subject: headerMap.subject || "(No subject)",
    sender: headerMap.from || null,
    recipients: [headerMap.to, headerMap.cc, headerMap.bcc].filter(Boolean),
    sentAt: headerMap.date ? new Date(headerMap.date).toISOString() : null,
    snippet: message.snippet || null,
    plainText: plain,
    htmlText: html,
    internalDate: message.internalDate || null,
    headers: headerMap,
  };
}

export async function fetchMessage(
  gmail: gmail_v1.Gmail,
  messageId: string,
) {
  const response = await withBackoff(() =>
    gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
      metadataHeaders: ["Subject", "From", "To", "Cc", "Date", "Message-ID"],
    }),
  );

  return normalizeGmailMessage(response.data);
}

export async function listMessageIds(
  gmail: gmail_v1.Gmail,
  options: { pageToken?: string; maxResults?: number; query?: string },
) {
  const response = await withBackoff(() =>
    gmail.users.messages.list({
      userId: "me",
      maxResults: options.maxResults || 50,
      pageToken: options.pageToken,
      q: options.query,
    }),
  );

  return {
    ids: (response.data.messages || []).map((message) => message.id).filter(Boolean) as string[],
    nextPageToken: response.data.nextPageToken || null,
    resultSizeEstimate: response.data.resultSizeEstimate || 0,
  };
}
