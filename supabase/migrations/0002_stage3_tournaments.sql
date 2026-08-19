-- ============================================================
-- StreakPartner Stage 3: Tournaments (MVP)
-- Follows the secure RPC + atomic balance pattern of Stage 1.
-- ============================================================

-- ============================================================
-- 1. TOURNAMENTS TABLE
-- ============================================================
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  size integer not null check (size in (4, 8, 16, 32)),
  entry_fee integer not null default 5 check (entry_fee > 0),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  current_players integer not null default 0,
  winner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. TOURNAMENT PARTICIPANTS (join tracking)
-- ============================================================
create table if not exists public.tournament_participants (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  seed integer,  -- bracket seed (1..size)
  primary key (tournament_id, player_id)
);

-- ============================================================
-- 3. TOURNAMENT MATCHES (bracket)
-- ============================================================
create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round integer not null check (round >= 1),
  match_index integer not null check (match_index >= 0),
  player1_id uuid references public.profiles (id) on delete set null,
  player2_id uuid references public.profiles (id) on delete set null,
  winner_id uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'bye')),
  created_at timestamptz not null default now(),
  unique (tournament_id, round, match_index)
);

-- ============================================================
-- 4. INDEXES
-- ============================================================
create index if not exists tournaments_status_idx on public.tournaments (status);
create index if not exists tournaments_creator_idx on public.tournaments (creator_id);
create index if not exists t_participants_tournament_idx on public.tournament_participants (tournament_id);
create index if not exists t_participants_player_idx on public.tournament_participants (player_id);
create index if not exists t_matches_tournament_idx on public.tournament_matches (tournament_id);

-- ============================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================
alter table public.tournaments enable row level security;
alter table public.tournament_participants enable row level security;
alter table public.tournament_matches enable row level security;

-- ============================================================
-- 6. RLS POLICIES (reads open to authenticated, writes via RPC)
-- ============================================================
create policy "tournaments_select" on public.tournaments
  for select using (auth.uid() is not null);

create policy "tournament_participants_select" on public.tournament_participants
  for select using (auth.uid() is not null);

create policy "tournament_matches_select" on public.tournament_matches
  for select using (auth.uid() is not null);

-- ============================================================
-- 7. SECURE RPC FUNCTIONS
-- ============================================================

-- ------------------------------------------------------------
-- create_tournament(name, size, entry_fee): create + creator joins
-- ------------------------------------------------------------
create or replace function public.create_tournament(
  p_name text,
  p_size integer,
  p_entry_fee integer default 5
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_creator_id uuid := auth.uid();
  v_new_balance integer;
  v_tournament_id uuid;
begin
  if v_creator_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Tournament name is required';
  end if;

  if p_size not in (4, 8, 16, 32) then
    raise exception 'Size must be 4, 8, 16, or 32';
  end if;

  if p_entry_fee is null or p_entry_fee <= 0 then
    raise exception 'Entry fee must be positive';
  end if;

  -- Atomic check-and-debit for creator entry fee
  update public.profiles
     set balance = balance - p_entry_fee,
         updated_at = now()
   where id = v_creator_id
     and balance >= p_entry_fee
   returning balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'Insufficient PromptCoin balance';
  end if;

  -- Record the entry fee transaction
  insert into public.coin_transactions (player_id, amount, balance_after, type, reference_id)
  values (v_creator_id, -p_entry_fee, v_new_balance, 'match_stake', null);

  -- Create the tournament
  insert into public.tournaments (name, size, entry_fee, creator_id, current_players)
  values (trim(p_name), p_size, p_entry_fee, v_creator_id, 1)
  returning id into v_tournament_id;

  -- Link the transaction to the tournament
  update public.coin_transactions
     set reference_id = v_tournament_id
   where player_id = v_creator_id
     and type = 'match_stake'
     and reference_id is null
     and created_at = (
       select max(created_at)
       from public.coin_transactions
       where player_id = v_creator_id
         and type = 'match_stake'
         and reference_id is null
     );

  -- Creator is seed 1
  insert into public.tournament_participants (tournament_id, player_id, seed)
  values (v_tournament_id, v_creator_id, 1);

  return v_tournament_id;
end;
$$;

-- ------------------------------------------------------------
-- join_tournament(tournament_id): deduct fee, add participant
-- ------------------------------------------------------------
create or replace function public.join_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_player_id uuid := auth.uid();
  v_tournament record;
  v_new_balance integer;
  v_next_seed integer;
begin
  if v_player_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock tournament row
  select * into v_tournament
    from public.tournaments
   where id = p_tournament_id
   for update;

  if v_tournament.id is null then
    raise exception 'Tournament not found';
  end if;

  if v_tournament.status <> 'open' then
    raise exception 'Tournament is not open for joining';
  end if;

  -- Prevent joining twice
  if exists (
    select 1 from public.tournament_participants
    where tournament_id = p_tournament_id and player_id = v_player_id
  ) then
    raise exception 'You have already joined this tournament';
  end if;

  -- Prevent joining a full tournament (implicitly via current_players)
  if v_tournament.current_players >= v_tournament.size then
    raise exception 'Tournament is full';
  end if;

  -- Atomic check-and-debit for entry fee
  update public.profiles
     set balance = balance - v_tournament.entry_fee,
         updated_at = now()
   where id = v_player_id
     and balance >= v_tournament.entry_fee
   returning balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'Insufficient PromptCoin balance';
  end if;

  -- Record the entry fee transaction
  insert into public.coin_transactions (player_id, amount, balance_after, type, reference_id)
  values (v_player_id, -v_tournament.entry_fee, v_new_balance, 'match_stake', p_tournament_id);

  -- Assign next seed
  select coalesce(max(seed), 0) + 1 into v_next_seed
    from public.tournament_participants
   where tournament_id = p_tournament_id;

  -- Add participant
  insert into public.tournament_participants (tournament_id, player_id, seed)
  values (p_tournament_id, v_player_id, v_next_seed);

  -- Increment player count
  update public.tournaments
     set current_players = current_players + 1,
         updated_at = now()
   where id = p_tournament_id;

  -- Auto-start tournament when full
  if v_tournament.current_players + 1 = v_tournament.size then
    -- Mark tournament as in_progress
    update public.tournaments
       set status = 'in_progress',
           updated_at = now()
     where id = p_tournament_id;

    -- Create first-round bracket matches
    perform public.generate_tournament_bracket(p_tournament_id);
  end if;
end;
$$;

-- ------------------------------------------------------------
-- generate_tournament_bracket(tournament_id): seed round 1
-- ------------------------------------------------------------
create or replace function public.generate_tournament_bracket(p_tournament_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_tournament record;
  v_num_rounds integer;
  v_total_matches integer;
begin
  select size into v_tournament
    from public.tournaments
   where id = p_tournament_id;

  if v_tournament.size is null then
    raise exception 'Tournament not found';
  end if;

  -- Number of rounds is log2(size) (round 1 = first round)
  v_num_rounds := log(2, v_tournament.size::numeric)::integer;

  -- Generate all bracket rounds from first round up
  for r in 1..v_num_rounds loop
    -- Number of matches in this round = size / 2^r
    v_total_matches := (v_tournament.size / power(2, r))::integer;

    for i in 0..(v_total_matches - 1) loop
      insert into public.tournament_matches (tournament_id, round, match_index, status)
      values (p_tournament_id, r, i, 'pending');
    end loop;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- get_tournament_with_players(tournament_id): helper to fetch
--   participant counts efficiently
-- ------------------------------------------------------------
create or replace function public.get_tournament_participant_count(p_tournament_id uuid)
returns integer
language sql
security definer set search_path = public
as $$
  select count(*)::integer
  from public.tournament_participants
  where tournament_id = p_tournament_id;
$$;