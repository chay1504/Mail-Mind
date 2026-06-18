"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Database,
  FileText,
  Inbox,
  Mail,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import type { ChatAnswer, ThreadCard, ThreadMessage } from "@/lib/types";

type Status = {
  tone: "idle" | "ok" | "error" | "loading";
  message: string;
};

export default function Home() {
  const [threads, setThreads] = useState<ThreadCard[]>([]);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [question, setQuestion] = useState("Which important emails need my attention?");
  const [answer, setAnswer] = useState<ChatAnswer | null>(null);
  const [draftPrompt, setDraftPrompt] = useState("Write a crisp follow-up reply.");
  const [draftMode, setDraftMode] = useState<"reply" | "compose">("reply");
  const [to, setTo] = useState("");
  const [draft, setDraft] = useState<{ subject: string; body: string; tone: string } | null>(null);
  const [status, setStatus] = useState<Status>({
    tone: "idle",
    message: "Connect Gmail, sync the inbox, then use the assistant.",
  });

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId),
    [threads, selectedThreadId],
  );

  async function loadThreads() {
    try {
      const response = await fetch("/api/gmail/threads");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load threads");
      setThreads(data.threads || []);
      if (!selectedThreadId && data.threads?.[0]?.id) {
        setSelectedThreadId(data.threads[0].id);
      }
    } catch {
      setThreads([]);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadInitialThreads() {
      try {
        const response = await fetch("/api/gmail/threads");
        const data = await response.json();
        if (!response.ok || !active) return;
        setThreads(data.threads || []);
        if (data.threads?.[0]?.id) {
          setSelectedThreadId(data.threads[0].id);
        }
      } catch {
        if (active) setThreads([]);
      }
    }

    void loadInitialThreads();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (selectedThreadId) {
      async function loadSelectedMessages() {
        try {
          const response = await fetch(`/api/gmail/threads/${selectedThreadId}`);
          const data = await response.json();
          if (!response.ok || !active) return;
          setMessages(data.messages || []);
        } catch {
          if (active) setMessages([]);
        }
      }

      void loadSelectedMessages();
    }

    return () => {
      active = false;
    };
  }, [selectedThreadId]);

  async function syncInbox() {
    setStatus({ tone: "loading", message: "Syncing Gmail and processing recent threads..." });
    try {
      const response = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxResults: 50, query: "newer_than:90d" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sync failed");
      setStatus({
        tone: "ok",
        message: `Synced ${data.synced} emails. ${data.nextPageToken ? "More pages are available for pagination." : "Batch complete."}`,
      });
      await loadThreads();
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Sync failed",
      });
    }
  }

  async function askAgent(nextQuestion = question) {
    setStatus({ tone: "loading", message: "Searching synced emails and asking Gemini..." });
    setAnswer(null);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: nextQuestion }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chat failed");
      setAnswer(data);
      setStatus({ tone: "ok", message: "Answer generated with source references." });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Chat failed",
      });
    }
  }

  async function runNewsletterDigest() {
    setStatus({ tone: "loading", message: "Deduplicating recent newsletter stories..." });
    setAnswer(null);
    try {
      const response = await fetch("/api/ai/newsletter-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 4 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Newsletter digest failed");
      setAnswer(data);
      setQuestion("List all important tech news from the past 4 days");
      setStatus({ tone: "ok", message: "Newsletter digest deduplicated with source references." });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Newsletter digest failed",
      });
    }
  }

  async function draftEmail() {
    setStatus({ tone: "loading", message: "Drafting with the selected context..." });
    setDraft(null);
    try {
      const response = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: draftMode,
          threadId: draftMode === "reply" ? selectedThreadId : undefined,
          subject: draftMode === "reply" ? selectedThread?.subject : undefined,
          prompt: draftPrompt,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Draft failed");
      setDraft(data);
      setStatus({ tone: "ok", message: "Draft ready. Review it before sending." });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Draft failed",
      });
    }
  }

  async function sendDraft() {
    if (!draft) return;
    setStatus({ tone: "loading", message: "Sending through Gmail API..." });
    try {
      const response = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject: draft.subject,
          body: draft.body,
          threadId: draftMode === "reply" ? selectedThreadId : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Send failed");
      setStatus({ tone: "ok", message: `Email sent through Gmail. Message id: ${data.id}` });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Send failed",
      });
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#14171f]">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
              <span className="rounded-full bg-[#111827] px-3 py-1 text-white">MailMind</span>
              Gmail Intelligence Platform
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950">
              Source-backed AI assistant for Gmail, powered by Supabase, Gemini, NVIDIA NIM, and n8n.
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="/api/auth/google/start"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Mail size={18} />
              Connect Gmail
            </a>
            <button
              onClick={syncInbox}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50"
            >
              <RefreshCw size={18} />
              Sync inbox
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[300px_1fr_390px]">
        <aside className="space-y-4">
          <Panel title="System">
            <div className="space-y-3 text-sm">
              <HealthRow icon={<Workflow size={16} />} label="n8n" value="Workflow JSON included" />
              <HealthRow icon={<Database size={16} />} label="Supabase" value="Postgres + pgvector" />
              <HealthRow icon={<Sparkles size={16} />} label="Gemini" value="Reasoning + embeddings" />
              <HealthRow icon={<ShieldCheck size={16} />} label="NVIDIA NIM" value="Secondary classifier" />
            </div>
          </Panel>

          <Panel title="Status">
            <div
              className={`rounded-md px-3 py-3 text-sm ${
                status.tone === "error"
                  ? "bg-red-50 text-red-700"
                  : status.tone === "ok"
                    ? "bg-emerald-50 text-emerald-700"
                    : status.tone === "loading"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-slate-100 text-slate-700"
              }`}
            >
              {status.message}
            </div>
          </Panel>

          <Panel title="Threads">
            <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
              {threads.length === 0 ? (
                <Empty icon={<Inbox size={22} />} text="No synced threads yet." />
              ) : (
                threads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`w-full rounded-md border p-3 text-left text-sm ${
                      selectedThreadId === thread.id
                        ? "border-slate-900 bg-slate-950 text-white"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="line-clamp-2 font-medium">{thread.subject || "(No subject)"}</div>
                    <div className="mt-2 flex items-center justify-between text-xs opacity-75">
                      <span>{thread.category || "Unprocessed"}</span>
                      <span>{thread.message_count || 1} msg</span>
                    </div>
                    {thread.priority && (
                      <div className="mt-2 text-xs opacity-75">Priority: {thread.priority}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          </Panel>
        </aside>

        <section className="space-y-5">
          <Panel title="Selected thread">
            {selectedThread ? (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-950">{selectedThread.subject}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedThread.category || "Uncategorized"} |{" "}
                      {selectedThread.last_message_at
                        ? new Date(selectedThread.last_message_at).toLocaleString()
                        : "No date"}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                    {selectedThread.gmail_thread_id}
                  </span>
                </div>
                <p className="mt-5 rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {selectedThread.thread_summary ||
                    "Thread has not been summarized yet. Sync runs summarization for recent threads when AI credentials are available."}
                </p>
                {selectedThread.key_facts?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedThread.key_facts.slice(0, 5).map((fact) => (
                      <span key={fact} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                        {fact}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <Empty icon={<FileText size={22} />} text="Select a synced thread to inspect it." />
            )}
          </Panel>

          <Panel title="Thread messages">
            {messages.length === 0 ? (
              <Empty icon={<MessageSquareText size={22} />} text="No messages loaded for this thread." />
            ) : (
              <div className="max-h-[440px] space-y-3 overflow-auto pr-1">
                {messages.map((message) => (
                  <article key={message.id} className="rounded-md border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap justify-between gap-3 text-xs text-slate-500">
                      <span className="font-medium text-slate-900">{message.sender || "Unknown sender"}</span>
                      <span>{message.sent_at ? new Date(message.sent_at).toLocaleString() : "No date"}</span>
                    </div>
                    <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {message.plain_text || message.snippet || "No readable body found."}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Ask the email agent">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  className="h-12 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-slate-900"
                  placeholder="Ask across your synced emails"
                />
              </div>
              <button
                onClick={() => askAgent()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Bot size={18} />
                Ask
              </button>
            </div>
            <button
              onClick={runNewsletterDigest}
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50"
            >
              <Sparkles size={16} />
              Bonus: dedupe newsletter news from last 4 days
            </button>

            {answer && (
              <div className="mt-4 rounded-md border border-slate-200 bg-white p-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Confidence: {answer.confidence}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{answer.answer}</p>
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Sources</div>
                  {answer.sources.length === 0 ? (
                    <p className="text-sm text-slate-500">No source was returned.</p>
                  ) : (
                    answer.sources.map((source) => (
                      <div key={source.messageId} className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                        <div className="font-medium text-slate-900">{source.subject}</div>
                        <div>{source.sender}</div>
                        <div>{source.date ? new Date(source.date).toLocaleString() : "No date"}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </Panel>
        </section>

        <aside className="space-y-5">
          <Panel title="Compose and reply">
            <div className="mb-3 grid grid-cols-2 rounded-md border border-slate-200 bg-slate-50 p-1 text-sm">
              {(["reply", "compose"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setDraftMode(mode)}
                  className={`rounded px-3 py-2 font-medium ${
                    draftMode === mode ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
                  }`}
                >
                  {mode === "reply" ? "Thread reply" : "New email"}
                </button>
              ))}
            </div>
            <input
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mb-3 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900"
              placeholder="Recipient email for sending"
            />
            <textarea
              value={draftPrompt}
              onChange={(event) => setDraftPrompt(event.target.value)}
              className="min-h-28 w-full rounded-md border border-slate-300 bg-white p-3 text-sm outline-none focus:border-slate-900"
              placeholder="Tell the AI what to write"
            />
            <button
              onClick={draftEmail}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Send size={18} />
              Generate draft
            </button>

            {draft && (
              <div className="mt-4 rounded-md border border-slate-200 bg-white p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{draft.tone}</div>
                <input
                  value={draft.subject}
                  onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                  className="mt-2 h-10 w-full rounded-md border border-slate-200 px-2 font-semibold text-slate-950 outline-none focus:border-slate-900"
                />
                <textarea
                  value={draft.body}
                  onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                  className="mt-3 min-h-48 w-full rounded-md border border-slate-200 p-2 text-sm leading-6 text-slate-700 outline-none focus:border-slate-900"
                />
                <button
                  onClick={sendDraft}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800"
                >
                  Send via Gmail
                </button>
              </div>
            )}
          </Panel>

          <Panel title="What this demo proves">
            <div className="space-y-3 text-sm leading-6 text-slate-700">
              <Proof icon={<Mail size={16} />} text="OAuth Gmail API sync with pagination and backoff." />
              <Proof icon={<MessageSquareText size={16} />} text="Thread summaries, context-aware replies, and source-backed chat." />
              <Proof icon={<Database size={16} />} text="Supabase schema stores threads, messages, labels, categories, and vectors." />
              <Proof icon={<ShieldCheck size={16} />} text="Newsletter digest route deduplicates stories from classified newsletters." />
            </div>
          </Panel>
        </aside>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </div>
  );
}

function HealthRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-500">{icon}</span>
      <div>
        <div className="font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-500">{value}</div>
      </div>
    </div>
  );
}

function Proof({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-1 text-slate-500">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500">
      {icon}
      <span className="mt-2">{text}</span>
    </div>
  );
}
