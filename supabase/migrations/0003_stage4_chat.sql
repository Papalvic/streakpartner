-- ============================================================
-- StreakPartner Stage 4: Chat MVP
-- General community chat + per-tournament chat.
-- ============================================================

-- ============================================================
-- 1. GENERAL CHAT MESSAGES
-- ============================================================
create table if not exists public.general_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (length(content) > 0 and length(content) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists general_chat_created_idx
  on public.general_chat_messages (created_at asc);

-- ============================================================
-- 2. TOURNAMENT CHAT MESSAGES
-- ============================================================
create table if not exists public.tournament_chat_messages (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (length(content) > 0 and length(content) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists tournament_chat_tournament_idx
  on public.tournament_chat_messages (tournament_id, created_at asc);

-- ============================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================
alter table public.general_chat_messages enable row level security;
alter table public.tournament_chat_messages enable row level security;

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

-- GENERAL CHAT: any authenticated user can read
create policy "general_chat_select" on public.general_chat_messages
  for select using (auth.uid() is not null);

-- GENERAL CHAT: authenticated users can insert their own messages
create policy "general_chat_insert_own" on public.general_chat_messages
  for insert with check (auth.uid() = user_id);

-- GENERAL CHAT: users can delete only their own messages
create policy "general_chat_delete_own" on public.general_chat_messages
  for delete using (auth.uid() = user_id);

-- TOURNAMENT CHAT: only tournament participants can read
create policy "tournament_chat_select_participant" on public.tournament_chat_messages
  for select using (
    auth.uid() is not null
    and exists (
      select 1 from public.tournament_participants tp
      where tp.tournament_id = tournament_chat_messages.tournament_id
        and tp.player_id = auth.uid()
    )
  );

-- TOURNAMENT CHAT: participants can insert their own messages
create policy "tournament_chat_insert_participant" on public.tournament_chat_messages
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.tournament_participants tp
      where tp.tournament_id = tournament_chat_messages.tournament_id
        and tp.player_id = auth.uid()
    )
  );

-- TOURNAMENT CHAT: users can delete only their own messages
create policy "tournament_chat_delete_own" on public.tournament_chat_messages
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 5. ENABLE REALTIME
-- ============================================================
alter publication supabase_realtime add table public.general_chat_messages;
alter publication supabase_realtime add table public.tournament_chat_messages;