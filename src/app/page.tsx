"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  FileText,
  Inbox,
  Mail,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import type { ChatAnswer, ThreadCard, ThreadMessage } from "@/lib/types";

type Status = {
  tone: "idle" | "ok" | "error" | "loading";
  message: string;
};

type WorkspaceTab = "overview" | "ask" | "compose" | "digest";

const tabs: Array<{ id: WorkspaceTab; label: string; helper: string }> = [
  { id: "overview", label: "Inbox review", helper: "Read synced threads and summaries" },
  { id: "ask", label: "Ask AI", helper: "Search across your email knowledge base" },
  { id: "compose", label: "Write email", helper: "Draft replies or new emails" },
  { id: "digest", label: "News digest", helper: "Deduplicate newsletter stories" },
];

export default function Home() {
  const [threads, setThreads] = useState<ThreadCard[]>([]);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [question, setQuestion] = useState("Which important emails need my attention?");
  const [answer, setAnswer] = useState<ChatAnswer | null>(null);
  const [draftPrompt, setDraftPrompt] = useState("Write a crisp follow-up reply.");
  const [draftMode, setDraftMode] = useState<"reply" | "compose">("reply");
  const [to, setTo] = useState("");
  const [draft, setDraft] = useState<{ subject: string; body: string; tone: string } | null>(null);
  const [status, setStatus] = useState<Status>({
    tone: "idle",
    message: "Start by connecting Gmail. Then sync your inbox to unlock the AI features.",
  });

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId),
    [threads, selectedThreadId],
  );

  const processedCount = threads.filter((thread) => thread.thread_summary || thread.category).length;
  const highPriorityCount = threads.filter((thread) => thread.priority === "high").length;
  const newsletterCount = threads.filter((thread) => thread.category === "Newsletters").length;

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

    async function loadSelectedMessages() {
      if (!selectedThreadId) {
        setMessages([]);
        return;
      }

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
        message: `Synced ${data.synced} emails. ${data.nextPageToken ? "More pages are available." : "This batch is complete."}`,
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
    setActiveTab("ask");
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
    setActiveTab("digest");
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
    setActiveTab("compose");
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
    <main className="min-h-screen bg-[#f4f6f8] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-600">
                <Sparkles size={15} />
                MailMind
              </div>
              <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Your Gmail, turned into a searchable AI workspace.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Connect Gmail, sync messages, review summaries, ask questions, and draft replies from one guided dashboard.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="/api/auth/google/start"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Mail size={18} />
                Connect Gmail
              </a>
              <button
                onClick={syncInbox}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50"
              >
                <RefreshCw size={18} />
                Sync inbox
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <Step number="1" title="Connect" text="Grant Gmail access once with Google OAuth." done={threads.length > 0} />
            <Step number="2" title="Sync" text="Pull recent threads into Supabase for processing." done={threads.length > 0} />
            <Step number="3" title="Use AI" text="Ask, summarize, draft, and dedupe with sources." done={processedCount > 0} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-5">
        <div
          className={`mb-5 rounded-md border px-4 py-3 text-sm ${
            status.tone === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : status.tone === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : status.tone === "loading"
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600"
          }`}
        >
          {status.message}
        </div>

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Threads" value={threads.length} />
              <Metric label="Processed" value={processedCount} />
              <Metric label="High priority" value={highPriorityCount} />
            </div>

            <Panel title="Inbox">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-slate-500">Select a thread to inspect</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {newsletterCount} newsletters
                </span>
              </div>
              <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
                {threads.length === 0 ? (
                  <Empty icon={<Inbox size={22} />} text="No synced threads yet. Connect Gmail, then sync." />
                ) : (
                  threads.map((thread) => (
                    <button
                      key={thread.id}
                      onClick={() => {
                        setSelectedThreadId(thread.id);
                        setActiveTab("overview");
                      }}
                      className={`w-full rounded-md border p-3 text-left text-sm transition ${
                        selectedThreadId === thread.id
                          ? "border-slate-900 bg-slate-950 text-white"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
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

          <section className="space-y-4">
            <div className="grid gap-2 md:grid-cols-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-md border p-3 text-left transition ${
                    activeTab === tab.id
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="text-sm font-semibold">{tab.label}</div>
                  <div className={`mt-1 text-xs ${activeTab === tab.id ? "text-slate-300" : "text-slate-500"}`}>
                    {tab.helper}
                  </div>
                </button>
              ))}
            </div>

            {activeTab === "overview" && (
              <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                <Panel title="Thread summary">
                  {selectedThread ? (
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-2xl font-semibold">{selectedThread.subject || "(No subject)"}</h2>
                          <p className="mt-1 text-sm text-slate-500">
                            {selectedThread.category || "Uncategorized"} |{" "}
                            {selectedThread.last_message_at
                              ? new Date(selectedThread.last_message_at).toLocaleString()
                              : "No date"}
                          </p>
                        </div>
                        {selectedThread.priority && <PriorityBadge value={selectedThread.priority} />}
                      </div>
                      <p className="mt-5 rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                        {selectedThread.thread_summary ||
                          "No AI summary yet. Syncing processes recent threads when AI credentials are available."}
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
                    <Empty icon={<FileText size={22} />} text="Choose a thread from the inbox list." />
                  )}
                </Panel>

                <Panel title="Thread messages">
                  {messages.length === 0 ? (
                    <Empty icon={<MessageSquareText size={22} />} text="Messages will appear after selecting a synced thread." />
                  ) : (
                    <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
                      {messages.map((message) => (
                        <article key={message.id} className="rounded-md border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap justify-between gap-3 text-xs text-slate-500">
                            <span className="font-medium text-slate-900">{message.sender || "Unknown sender"}</span>
                            <span>{message.sent_at ? new Date(message.sent_at).toLocaleString() : "No date"}</span>
                          </div>
                          <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                            {message.plain_text || message.snippet || "No readable body found."}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
            )}

            {activeTab === "ask" && (
              <Panel title="Ask your email agent">
                <p className="mb-4 text-sm leading-6 text-slate-600">
                  Ask questions that should be answered only from synced emails. Each answer shows the source messages it used.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      className="h-12 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-slate-900"
                      placeholder="Example: Which companies rejected my job application?"
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
                <AnswerBlock answer={answer} />
              </Panel>
            )}

            {activeTab === "compose" && (
              <Panel title="Compose and reply">
                <p className="mb-4 text-sm leading-6 text-slate-600">
                  Choose whether you want to reply to the selected thread or create a fresh email. Generate, review, edit, then send.
                </p>
                <div className="mb-4 grid max-w-md grid-cols-2 rounded-md border border-slate-200 bg-slate-50 p-1 text-sm">
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
                <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Recipient</label>
                    <input
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                      className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900"
                      placeholder="name@example.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Instruction</label>
                    <textarea
                      value={draftPrompt}
                      onChange={(event) => setDraftPrompt(event.target.value)}
                      className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white p-3 text-sm outline-none focus:border-slate-900"
                      placeholder="Tell the AI what to write"
                    />
                  </div>
                </div>
                <button
                  onClick={draftEmail}
                  className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <Send size={18} />
                  Generate draft
                </button>
                {draft && (
                  <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{draft.tone}</div>
                    <input
                      value={draft.subject}
                      onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                      className="mt-2 h-10 w-full rounded-md border border-slate-200 px-2 font-semibold text-slate-950 outline-none focus:border-slate-900"
                    />
                    <textarea
                      value={draft.body}
                      onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                      className="mt-3 min-h-56 w-full rounded-md border border-slate-200 p-3 text-sm leading-6 text-slate-700 outline-none focus:border-slate-900"
                    />
                    <button
                      onClick={sendDraft}
                      className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800"
                    >
                      Send via Gmail
                    </button>
                  </div>
                )}
              </Panel>
            )}

            {activeTab === "digest" && (
              <Panel title="Newsletter deduplication">
                <p className="mb-4 text-sm leading-6 text-slate-600">
                  This bonus workflow scans recent newsletter emails, groups repeated stories, and returns one clean digest with attribution.
                </p>
                <button
                  onClick={runNewsletterDigest}
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <Sparkles size={18} />
                  Generate 4-day digest
                </button>
                <AnswerBlock answer={answer} />
              </Panel>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function Step({ number, title, text, done }: { number: string; title: string; text: string; done: boolean }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold ${done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
          {done ? <CheckCircle2 size={17} /> : number}
        </div>
        <div>
          <div className="font-semibold text-slate-950">{title}</div>
          <div className="mt-1 text-sm leading-5 text-slate-500">{text}</div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function PriorityBadge({ value }: { value: "low" | "medium" | "high" }) {
  const style =
    value === "high"
      ? "bg-red-50 text-red-700"
      : value === "medium"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-3 py-1 text-sm font-medium ${style}`}>{value} priority</span>;
}

function AnswerBlock({ answer }: { answer: ChatAnswer | null }) {
  if (!answer) return null;

  return (
    <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Confidence: {answer.confidence}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{answer.answer}</p>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {answer.sources.length === 0 ? (
          <p className="text-sm text-slate-500">No source was returned.</p>
        ) : (
          answer.sources.map((source) => (
            <div key={source.messageId} className="rounded-md bg-white p-3 text-xs text-slate-600">
              <div className="font-medium text-slate-900">{source.subject}</div>
              <div>{source.sender}</div>
              <div>{source.date ? new Date(source.date).toLocaleString() : "No date"}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
      {icon}
      <span className="mt-2">{text}</span>
    </div>
  );
}
