import { getRuntimeConfig } from "./env";
import type { ChatAnswer, EmailCategory, SourceRef } from "./types";

const categories: EmailCategory[] = [
  "Newsletters",
  "Job / Recruitment",
  "Finance",
  "Notifications",
  "Personal",
  "Work / Professional",
  "Other",
];

function parseJson<T>(text: string, fallback: T): T {
  try {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

async function callGemini(prompt: string, system = "") {
  const config = getRuntimeConfig();

  if (!config.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: system
          ? {
              parts: [{ text: system }],
            }
          : undefined,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
}

export async function embedText(text: string) {
  const config = getRuntimeConfig();

  if (!config.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiEmbeddingModel}:embedContent?key=${config.geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text: text.slice(0, 12000) }] },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini embedding failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.embedding?.values as number[];
}

export async function classifyWithNim(input: string): Promise<EmailCategory | null> {
  const config = getRuntimeConfig();

  if (!config.nvidiaApiKey) return null;

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.nvidiaApiKey}`,
    },
    body: JSON.stringify({
      model: config.nvidiaModel,
      temperature: 0,
      max_tokens: 40,
      messages: [
        {
          role: "system",
          content:
            "Classify the email into exactly one category. Return only the category name.",
        },
        {
          role: "user",
          content: `Allowed categories: ${categories.join(", ")}\n\nEmail:\n${input.slice(0, 6000)}`,
        },
      ],
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const category = String(data.choices?.[0]?.message?.content || "").trim();
  return categories.find((allowed) => allowed.toLowerCase() === category.toLowerCase()) || null;
}

export async function summarizeThread(input: {
  subject: string;
  messages: Array<{ sender: string | null; sentAt: string | null; body: string }>;
}) {
  const categoryFromNim = await classifyWithNim(
    `${input.subject}\n\n${input.messages.map((message) => message.body).join("\n\n")}`,
  );

  const text = await callGemini(
    JSON.stringify({
      task: "Summarize and classify this Gmail thread.",
      allowedCategories: categories,
      categoryHintFromNvidiaNim: categoryFromNim,
      thread: input,
      outputShape: {
        summary: "5 to 8 sentence summary with concrete next actions if any",
        category: "one allowed category",
        priority: "low | medium | high",
        keyFacts: ["short facts grounded in the thread"],
      },
    }),
    "You are an email intelligence engine. Use only the given email thread. Return valid JSON only.",
  );

  return parseJson<{
    summary: string;
    category: EmailCategory;
    priority: "low" | "medium" | "high";
    keyFacts: string[];
  }>(text, {
    summary: "Summary unavailable. Configure Gemini and retry processing.",
    category: categoryFromNim || "Other",
    priority: "medium",
    keyFacts: [],
  });
}

export async function answerFromSources(input: {
  question: string;
  sources: Array<SourceRef & { content: string }>;
  conversation?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<ChatAnswer> {
  let text = "";
  try {
    text = await callGemini(
      JSON.stringify({
        task: "Answer the user's question using only the provided email sources.",
        hardRules: [
          "Do not use outside knowledge.",
          "If the answer is not present, say that it is not found in the synced emails.",
          "Cite source message ids in the sources array.",
          "Synthesize across emails only when the sources support it.",
        ],
        question: input.question,
        conversation: input.conversation || [],
        sources: input.sources.map((source) => ({
          messageId: source.messageId,
          threadId: source.threadId,
          subject: source.subject,
          sender: source.sender,
          date: source.date,
          snippet: source.snippet,
          content: source.content.slice(0, 6000),
        })),
        outputShape: {
          answer: "grounded answer",
          confidence: "high | medium | low",
          usedMessageIds: ["message ids used"],
        },
      }),
      "You are a source-strict Gmail assistant. Return valid JSON only.",
    );
  } catch {
    const fallbackSources = input.sources.slice(0, 5);
    return {
      answer: fallbackSources.length
        ? `AI quota is temporarily unavailable, so here are the most relevant synced emails I found for "${input.question}": ${fallbackSources
            .map((source) => `${source.subject} from ${source.sender}`)
            .join("; ")}.`
        : "I could not find matching synced emails for that question.",
      confidence: fallbackSources.length ? "medium" : "low",
      sources: fallbackSources.map((source) => ({
        messageId: source.messageId,
        threadId: source.threadId,
        subject: source.subject,
        sender: source.sender,
        date: source.date,
        snippet: source.snippet,
      })),
    };
  }

  const parsed = parseJson<{
    answer: string;
    confidence: "high" | "medium" | "low";
    usedMessageIds: string[];
  }>(text, {
    answer: "I could not answer from the synced emails.",
    confidence: "low",
    usedMessageIds: [],
  });

  const used = new Set(parsed.usedMessageIds || []);
  const sources = input.sources
    .filter((source) => used.size === 0 || used.has(source.messageId))
    .map((source) => ({
      messageId: source.messageId,
      threadId: source.threadId,
      subject: source.subject,
      sender: source.sender,
      date: source.date,
      snippet: source.snippet,
    }))
    .slice(0, 8);

  return {
    answer: parsed.answer,
    confidence: parsed.confidence || "low",
    sources,
  };
}

export async function draftEmail(input: {
  mode: "compose" | "reply";
  prompt: string;
  thread?: Array<{ sender: string | null; sentAt: string | null; body: string }>;
  subject?: string | null;
}) {
  let text = "";
  try {
    text = await callGemini(
      JSON.stringify({
        task: input.mode === "reply" ? "Draft a thread-aware reply" : "Draft a new email",
        prompt: input.prompt,
        subject: input.subject,
        threadContext: input.thread || [],
        outputShape: {
          subject: "email subject",
          body: "complete professional email body",
          tone: "short tone description",
        },
      }),
      "You write concise professional emails. For replies, respect the provided thread context. Return valid JSON only.",
    );
  } catch {
    const subject = input.subject || "Draft email";
    const contextLine = input.thread?.length
      ? "I reviewed the previous thread context and wanted to respond clearly."
      : "I wanted to follow up with a clear note.";

    return {
      subject,
      body: `Hi,\n\n${contextLine}\n\n${input.prompt}\n\nBest,\nChaitanya`,
      tone: "fallback professional",
    };
  }

  return parseJson<{ subject: string; body: string; tone: string }>(text, {
    subject: input.subject || "Draft email",
    body: "Draft unavailable. Configure Gemini and retry.",
    tone: "professional",
  });
}
