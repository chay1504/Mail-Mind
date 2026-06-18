export type EmailCategory =
  | "Newsletters"
  | "Job / Recruitment"
  | "Finance"
  | "Notifications"
  | "Personal"
  | "Work / Professional"
  | "Other";

export type SourceRef = {
  messageId: string;
  threadId: string;
  subject: string;
  sender: string;
  date: string | null;
  snippet?: string | null;
};

export type ChatAnswer = {
  answer: string;
  sources: SourceRef[];
  confidence: "high" | "medium" | "low";
};

export type ThreadMessage = {
  id: string;
  gmail_message_id: string;
  sender: string | null;
  recipients: string[] | null;
  sent_at: string | null;
  snippet: string | null;
  plain_text: string | null;
  message_summary: string | null;
};

export type ThreadCard = {
  id: string;
  gmail_thread_id: string;
  subject: string | null;
  participants: string[] | null;
  last_message_at: string | null;
  thread_summary: string | null;
  category: EmailCategory | null;
  priority: "low" | "medium" | "high" | null;
  key_facts: string[] | null;
  message_count: number | null;
};
