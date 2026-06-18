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
import type { ChatAnswer, ThreadCard } from "@/lib/types";

type Status = {
  tone: "idle" | "ok" | "error" | "loading";
  message: string;
};

export default function Home() {
  const [threads, setThreads] = useState<ThreadCard[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [question, setQuestion] = useState("Which important emails need my attention?");
  const [answer, setAnswer] = useState<ChatAnswer | null>(null);
  const [draftPrompt, setDraftPrompt] = useState("Write a crisp follow-up reply.");
  const [draft, setDraft] = useState<{ subject: string; body: string; tone: string } | null>(null);
  const [status, setStatus] = useState<Status>({
    tone: "idle",
    message: "Add credentials, connect Gmail, then sync your inbox.",
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
        if (!response.ok) return;
        if (!active) return;
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
        message: `Synced ${data.synced} emails. ${data.nextPageToken ? "More pages are available." : "No more pages in this batch."}`,
      });
      await loadThreads();
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Sync failed",
      });
    }
  }

  async function askAgent() {
    setStatus({ tone: "loading", message: "Searching synced emails and asking Gemini..." });
    setAnswer(null);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
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

  async function draftReply() {
    setStatus({ tone: "loading", message: "Drafting with full thread context..." });
    setDraft(null);
    try {
      const response = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: selectedThreadId ? "reply" : "compose",
          threadId: selectedThreadId || undefined,
          subject: selectedThread?.subject,
          prompt: draftPrompt,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Draft failed");
      setDraft(data);
      setStatus({ tone: "ok", message: "Draft ready for review. Sending is intentionally manual." });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Draft failed",
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
              Source-backed AI assistant for Gmail, powered by n8n workflows.
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

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[290px_1fr_380px]">
        <aside className="space-y-4">
          <Panel title="System">
            <div className="space-y-3 text-sm">
              <HealthRow icon={<Workflow size={16} />} label="n8n" value="Local workflow engine" />
              <HealthRow icon={<Database size={16} />} label="Supabase" value="Postgres + pgvector" />
              <HealthRow icon={<Sparkles size={16} />} label="Gemini" value="Main reasoning model" />
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
              </div>
            ) : (
              <Empty icon={<FileText size={22} />} text="Select a synced thread to inspect it." />
            )}
          </Panel>

          <Panel title="Ask the email agent">
            <div className="flex gap-3">
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
                onClick={askAgent}
                className="inline-flex h-12 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Bot size={18} />
                Ask
              </button>
            </div>

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
          <Panel title="Draft assistant">
            <textarea
              value={draftPrompt}
              onChange={(event) => setDraftPrompt(event.target.value)}
              className="min-h-28 w-full rounded-md border border-slate-300 bg-white p-3 text-sm outline-none focus:border-slate-900"
              placeholder="Tell the AI what to write"
            />
            <button
              onClick={draftReply}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Send size={18} />
              Generate draft
            </button>

            {draft && (
              <div className="mt-4 rounded-md border border-slate-200 bg-white p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{draft.tone}</div>
                <h3 className="mt-2 font-semibold text-slate-950">{draft.subject}</h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{draft.body}</p>
              </div>
            )}
          </Panel>

          <Panel title="What this demo proves">
            <div className="space-y-3 text-sm leading-6 text-slate-700">
              <Proof icon={<Mail size={16} />} text="Real Gmail API OAuth and sync path, not IMAP." />
              <Proof icon={<MessageSquareText size={16} />} text="Thread-aware summaries and replies." />
              <Proof icon={<Database size={16} />} text="Supabase schema supports pgvector retrieval." />
              <Proof icon={<ShieldCheck size={16} />} text="Agent answers are source-backed by design." />
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
