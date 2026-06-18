create extension if not exists vector;
create extension if not exists pg_trgm;

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gmail_oauth_tokens (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  access_token text,
  refresh_token text,
  scope text,
  token_type text,
  expiry_date bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gmail_sync_state (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  history_id text,
  last_full_sync_at timestamptz,
  last_incremental_sync_at timestamptz,
  next_page_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  gmail_thread_id text not null,
  subject text,
  participants text[] default '{}',
  last_message_at timestamptz,
  thread_summary text,
  category text check (
    category in (
      'Newsletters',
      'Job / Recruitment',
      'Finance',
      'Notifications',
      'Personal',
      'Work / Professional',
      'Other'
    )
  ),
  priority text check (priority in ('low', 'medium', 'high')),
  key_facts jsonb default '[]'::jsonb,
  message_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, gmail_thread_id)
);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text not null,
  history_id text,
  label_ids text[] default '{}',
  subject text,
  sender text,
  recipients text[] default '{}',
  sent_at timestamptz,
  snippet text,
  plain_text text,
  html_text text,
  raw_headers jsonb default '{}'::jsonb,
  message_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

create table if not exists public.email_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  message_id uuid not null references public.email_messages(id) on delete cascade,
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text not null,
  subject text,
  sender text,
  sent_at timestamptz,
  snippet text,
  content text not null,
  embedding vector(768),
  search_document tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(subject, '') || ' ' ||
      coalesce(sender, '') || ' ' ||
      coalesce(snippet, '') || ' ' ||
      coalesce(content, '')
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id)
);

create table if not exists public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  interaction_type text not null,
  prompt text not null,
  response jsonb not null,
  source_message_ids uuid[] default '{}',
  created_at timestamptz not null default now()
);

create index if not exists email_threads_user_last_message_idx
  on public.email_threads (user_id, last_message_at desc);

create index if not exists email_messages_thread_sent_idx
  on public.email_messages (thread_id, sent_at asc);

create index if not exists email_messages_user_gmail_thread_idx
  on public.email_messages (user_id, gmail_thread_id);

create index if not exists email_chunks_search_idx
  on public.email_chunks using gin (search_document);

create index if not exists email_chunks_embedding_idx
  on public.email_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.refresh_thread_rollup()
returns trigger
language plpgsql
as $$
begin
  update public.email_threads t
  set
    message_count = (
      select count(*) from public.email_messages m where m.thread_id = t.id
    ),
    participants = (
      select array_remove(array_agg(distinct m.sender), null)
      from public.email_messages m
      where m.thread_id = t.id
    ),
    last_message_at = (
      select max(m.sent_at) from public.email_messages m where m.thread_id = t.id
    ),
    updated_at = now()
  where t.id = new.thread_id;

  return new;
end;
$$;

drop trigger if exists email_messages_refresh_thread_rollup on public.email_messages;
create trigger email_messages_refresh_thread_rollup
after insert or update on public.email_messages
for each row execute function public.refresh_thread_rollup();

create or replace function public.match_email_chunks(
  query_embedding vector(768),
  match_user_id uuid,
  match_count int default 8
)
returns table (
  message_id uuid,
  thread_id uuid,
  gmail_message_id text,
  gmail_thread_id text,
  subject text,
  sender text,
  sent_at timestamptz,
  snippet text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    c.message_id,
    c.thread_id,
    c.gmail_message_id,
    c.gmail_thread_id,
    c.subject,
    c.sender,
    c.sent_at,
    c.snippet,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.email_chunks c
  where c.user_id = match_user_id
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

alter table public.user_profiles enable row level security;
alter table public.gmail_oauth_tokens enable row level security;
alter table public.gmail_sync_state enable row level security;
alter table public.email_threads enable row level security;
alter table public.email_messages enable row level security;
alter table public.email_chunks enable row level security;
alter table public.ai_interactions enable row level security;
