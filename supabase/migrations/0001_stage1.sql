-- ============================================================
-- StreakPartner Stage 1: Auth, Profiles, Matches, Coins
-- ============================================================

-- ============================================================
-- 1. PROFILES TABLE
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  balance integer not null default 1000 check (balance >= 0),
  matches_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  tournament_wins integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. COIN TRANSACTIONS (immutable ledger)
-- ============================================================
create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null,
  balance_after integer not null,
  type text not null check (type in ('signup_bonus', 'match_stake', 'match_winnings')),
  reference_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists coin_transactions_player_idx on public.coin_transactions (player_id);
create index if not exists coin_transactions_ref_idx on public.coin_transactions (reference_id);

-- ============================================================
-- 3. MATCHES
-- ============================================================
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles (id) on delete cascade,
  opponent_id uuid not null references public.profiles (id) on delete cascade,
  stake integer not null default 5 check (stake > 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'completed', 'cancelled')),
  winner_id uuid references public.profiles (id) on delete set null,
  settled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_different_players check (challenger_id <> opponent_id)
);

create index if not exists matches_challenger_idx on public.matches (challenger_id);
create index if not exists matches_opponent_idx on public.matches (opponent_id);
create index if not exists matches_status_idx on public.matches (status);

-- ============================================================
-- 4. MATCH RESULTS (screenshots + scores)
-- ============================================================
create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches (id) on delete cascade,
  winner_id uuid not null references public.profiles (id) on delete cascade,
  challenger_score integer not null check (challenger_score >= 0),
  opponent_score integer not null check (opponent_score >= 0),
  screenshot_url text not null,
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.matches enable row level security;
alter table public.match_results enable row level security;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- PROFILES: users can read all profiles, update only their own
create policy "profiles_select" on public.profiles
  for select using (true);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- COIN TRANSACTIONS: users can read only their own; no insert/update/delete
create policy "coin_transactions_select_own" on public.coin_transactions
  for select using (auth.uid() = player_id);

-- MATCHES: authenticated users can read all matches
create policy "matches_select" on public.matches
  for select using (auth.uid() is not null);

-- MATCH RESULTS: authenticated users can read all results
create policy "match_results_select" on public.match_results
  for select using (auth.uid() is not null);

-- ============================================================
-- 7. TRIGGER: create profile + grant 1,000 PromptCoin on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, balance)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'player_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username', 'Player'),
    1000
  );

  insert into public.coin_transactions (player_id, amount, balance_after, type, reference_id)
  values (new.id, 1000, 1000, 'signup_bonus', new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 8. SECURE RPC FUNCTIONS
-- ============================================================

-- ------------------------------------------------------------
-- create_match(opponent_id): challenger stakes 5 coins
-- ------------------------------------------------------------
create or replace function public.create_match(p_opponent_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_challenger_id uuid := auth.uid();
  v_stake integer := 5;
  v_new_balance integer;
  v_match_id uuid;
begin
  if v_challenger_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_challenger_id = p_opponent_id then
    raise exception 'Cannot challenge yourself';
  end if;

  -- Check opponent exists
  if not exists (select 1 from public.profiles where id = p_opponent_id) then
    raise exception 'Opponent does not exist';
  end if;

  -- Atomic check-and-debit: only succeeds if balance >= stake
  update public.profiles
     set balance = balance - v_stake,
         updated_at = now()
   where id = v_challenger_id
     and balance >= v_stake
   returning balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'Insufficient PromptCoin balance';
  end if;

  -- Record the stake transaction
  insert into public.coin_transactions (player_id, amount, balance_after, type, reference_id)
  values (v_challenger_id, -v_stake, v_new_balance, 'match_stake', null);

  -- Create the match
  insert into public.matches (challenger_id, opponent_id, stake)
  values (v_challenger_id, p_opponent_id, v_stake)
  returning id into v_match_id;

  -- Link the transaction to the match
  update public.coin_transactions
     set reference_id = v_match_id
   where player_id = v_challenger_id
     and type = 'match_stake'
     and reference_id is null
   order by created_at desc
   limit 1;

  return v_match_id;
end;
$$;

-- ------------------------------------------------------------
-- accept_match(match_id): opponent stakes 5 coins
-- ------------------------------------------------------------
create or replace function public.accept_match(p_match_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_opponent_id uuid := auth.uid();
  v_stake integer;
  v_new_balance integer;
  v_match_status text;
begin
  if v_opponent_id is null then
    raise exception 'Not authenticated';
  end if;

  select stake, status into v_stake, v_match_status
    from public.matches
   where id = p_match_id
     for update;

  if v_match_status is null then
    raise exception 'Match not found';
  end if;

  if v_match_status <> 'pending' then
    raise exception 'Match is not pending';
  end if;

  -- Verify caller is the opponent
  if not exists (select 1 from public.matches where id = p_match_id and opponent_id = v_opponent_id) then
    raise exception 'Only the opponent can accept this match';
  end if;

  -- Atomic check-and-debit
  update public.profiles
     set balance = balance - v_stake,
         updated_at = now()
   where id = v_opponent_id
     and balance >= v_stake
   returning balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'Insufficient PromptCoin balance';
  end if;

  -- Record the stake transaction
  insert into public.coin_transactions (player_id, amount, balance_after, type, reference_id)
  values (v_opponent_id, -v_stake, v_new_balance, 'match_stake', p_match_id);

  -- Mark match as accepted
  update public.matches
     set status = 'accepted',
         updated_at = now()
   where id = p_match_id;
end;
$$;

-- ------------------------------------------------------------
-- settle_match(...): winner gets 10 coins, updates stats
-- ------------------------------------------------------------
create or replace function public.settle_match(
  p_match_id uuid,
  p_winner_id uuid,
  p_challenger_score integer,
  p_opponent_score integer,
  p_screenshot_url text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_match record;
  v_winner_balance integer;
  v_pot integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock the match row to prevent concurrent settlement
  select * into v_match
    from public.matches
   where id = p_match_id
   for update;

  if v_match.id is null then
    raise exception 'Match not found';
  end if;

  if v_match.status <> 'accepted' then
    raise exception 'Match must be accepted before settlement';
  end if;

  if v_match.settled then
    raise exception 'Match already settled';
  end if;

  -- Winner must be one of the two players
  if p_winner_id not in (v_match.challenger_id, v_match.opponent_id) then
    raise exception 'Winner must be a participant in the match';
  end if;

  -- Winner must have the higher score
  if p_winner_id = v_match.challenger_id then
    if p_challenger_score <= p_opponent_score then
      raise exception 'Winner must have a higher score';
    end if;
  else
    if p_opponent_score <= p_challenger_score then
      raise exception 'Winner must have a higher score';
    end if;
  end if;

  -- Only a participant can submit the result
  if auth.uid() not in (v_match.challenger_id, v_match.opponent_id) then
    raise exception 'Only match participants can submit results';
  end if;

  -- Insert result (UNIQUE on match_id blocks double settlement)
  insert into public.match_results (match_id, winner_id, challenger_score, opponent_score, screenshot_url, submitted_by)
  values (p_match_id, p_winner_id, p_challenger_score, p_opponent_score, p_screenshot_url, auth.uid());

  -- Credit winner with the pot (2 * stake)
  v_pot := v_match.stake * 2;

  update public.profiles
     set balance = balance + v_pot,
         updated_at = now()
   where id = p_winner_id
   returning balance into v_winner_balance;

  -- Record winnings transaction
  insert into public.coin_transactions (player_id, amount, balance_after, type, reference_id)
  values (p_winner_id, v_pot, v_winner_balance, 'match_winnings', p_match_id);

  -- Update match
  update public.matches
     set status = 'completed',
         winner_id = p_winner_id,
         settled = true,
         updated_at = now()
   where id = p_match_id;

  -- Update player stats
  update public.profiles
     set matches_played = matches_played + 1,
         wins = wins + 1,
         updated_at = now()
   where id = p_winner_id;

  update public.profiles
     set matches_played = matches_played + 1,
         losses = losses + 1,
         updated_at = now()
   where id = case when p_winner_id = v_match.challenger_id then v_match.opponent_id else v_match.challenger_id end;
end;
$$;

-- ============================================================
-- 9. STORAGE BUCKET for match proof screenshots
-- ============================================================
insert into storage.buckets (id, name, public)
values ('match-proofs', 'match-proofs', false)
on conflict (id) do nothing;

-- Only authenticated users can upload to match-proofs
create policy "match_proofs_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'match-proofs');

-- Only match participants can read their own proof (via signed URLs)
create policy "match_proofs_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'match-proofs');