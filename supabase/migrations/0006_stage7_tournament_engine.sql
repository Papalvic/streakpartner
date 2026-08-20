-- ============================================================
-- StreakPartner Stage 7: Fully playable tournaments
-- Reuses existing tournament tables + Stage 6 match architecture.
-- No extra 5-coin match stake. Prize paid from entry-fee pool.
-- ============================================================

-- 1. Allow tournament_prize transaction type
alter table public.coin_transactions drop constraint if exists coin_transactions_type_check;
alter table public.coin_transactions add constraint coin_transactions_type_check
  check (type in ('signup_bonus','match_stake','match_winnings','match_refund','tournament_prize'));

-- 2. Extend tournament_matches with result + proof columns
alter table public.tournament_matches
  add column if not exists player1_score integer check (player1_score is null or player1_score >= 0);
alter table public.tournament_matches
  add column if not exists player2_score integer check (player2_score is null or player2_score >= 0);
alter table public.tournament_matches
  add column if not exists is_draw boolean not null default false;
alter table public.tournament_matches
  add column if not exists screenshot_url text;
alter table public.tournament_matches
  add column if not exists updated_at timestamptz not null default now();

-- 3. Rewrite generate_tournament_bracket: create slots AND assign Round 1 players
drop function if exists public.generate_tournament_bracket(uuid);
create or replace function public.generate_tournament_bracket(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tournament record;
  v_num_rounds integer;
  v_matches integer;
  v_r integer;
  v_idx integer;
  v_match uuid;
  v_p1 uuid;
  v_p2 uuid;
  v_seed integer;
begin
  select size into v_tournament from public.tournaments where id = p_tournament_id;
  if v_tournament.size is null then raise exception 'Tournament not found'; end if;
  v_num_rounds := log(2, v_tournament.size::numeric)::integer;

  -- Create all bracket slots for each round
  for v_r in 1..v_num_rounds loop
    v_matches := (v_tournament.size / power(2, v_r))::integer;
    for v_idx in 0..(v_matches - 1) loop
      insert into public.tournament_matches (tournament_id, round, match_index, status)
      values (p_tournament_id, v_r, v_idx, 'pending')
      on conflict (tournament_id, round, match_index) do nothing;
    end loop;
  end loop;

  -- Assign players to Round 1 (sequential seed pairing by ascending seed)
  v_matches := (v_tournament.size / 2)::integer;
  for v_idx in 0..(v_matches - 1) loop
    select player_id into v_p1 from public.tournament_participants
      where tournament_id = p_tournament_id order by seed asc offset (v_idx*2) limit 1;
    select player_id into v_p2 from public.tournament_participants
      where tournament_id = p_tournament_id order by seed asc offset (v_idx*2 + 1) limit 1;
    update public.tournament_matches
       set player1_id = v_p1, player2_id = v_p2
     where tournament_id = p_tournament_id and round = 1 and match_index = v_idx;
  end loop;
end; $$;

-- 4. submit_tournament_match_result: participant submits; RPC validates/advances/pays
create or replace function public.submit_tournament_match_result(
  p_match_id uuid,
  p_player1_score integer,
  p_player2_score integer,
  p_screenshot_url text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tournament record;
  v_match record;
  v_winner uuid := null;
  v_prize integer;
  v_balance integer;
  v_next_round integer;
  v_next_idx integer;
  v_next_slot integer;
  p1uuid uuid;
  p2uuid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_player1_score is null or p_player2_score is null or p_player1_score < 0 or p_player2_score < 0
    then raise exception 'Scores must be non-negative integers'; end if;

  -- Lock the tournament match row
  select * into v_match from public.tournament_matches where id = p_match_id for update;
  if v_match.id is null then raise exception 'Tournament match not found'; end if;

  -- Lock the parent tournament
  select * into v_tournament from public.tournaments where id = v_match.tournament_id for update;
  if v_tournament.id is null then raise exception 'Tournament not found'; end if;

  if v_match.status = 'completed' then raise exception 'Tournament match already settled'; end if;
  if v_match.status = 'bye' then raise exception 'Match is a bye'; end if;

  -- Participants only (server-side verification)
  if auth.uid() not in (v_match.player1_id, v_match.player2_id)
    then raise exception 'Only tournament match participants can submit results'; end if;

  -- Winner from scores (never trust client)
  if p_player1_score > p_player2_score then v_winner := v_match.player1_id;
  elsif p_player2_score > p_player1_score then v_winner := v_match.player2_id; end if;

  -- Record the match result (winner only when there's a non-draw outcome)
  update public.tournament_matches
     set player1_score = p_player1_score,
         player2_score = p_player2_score,
         is_draw = (v_winner is null),
         screenshot_url = coalesce(p_screenshot_url, screenshot_url),
         winner_id = v_winner,
         status = case when v_winner is null then 'pending' else 'completed' end,
         updated_at = now()
   where id = p_match_id;

  -- Determine next-round slot
  v_next_round := v_match.round + 1;
  v_next_idx := floor(v_match.match_index / 2);

  if v_winner is null then
    -- DRAW — REPLAY REQUIRED:
    --   * Nobody advances / is eliminated.
    --   * Match stays status='pending' so the same two players can replay it.
    --   * The tournament is NOT completed, no prize paid, no wins incremented.
    --   * No extra PromptCoin stake is charged (entry fee already paid).
    return;
  end if;

  -- If there's a next round, advance the winner into it
  if v_next_round <= (select log(2, v_tournament.size::numeric)::integer) then
    -- slot 1 if this was even index, slot 2 if odd
    v_next_slot := (v_match.match_index % 2) + 1;
    if v_next_slot = 1 then
      update public.tournament_matches set player1_id = v_winner
        where tournament_id = v_match.tournament_id and round = v_next_round and match_index = v_next_idx;
    else
      update public.tournament_matches set player2_id = v_winner
        where tournament_id = v_match.tournament_id and round = v_next_round and match_index = v_next_idx;
    end if;
  end if;

  -- If this was the final (last round), tournament is complete: pay prize once
  if v_match.round = (select log(2, v_tournament.size::numeric)::integer)
     and v_winner is not null then

    if v_tournament.status = 'completed' then raise exception 'Tournament already completed'; end if;

    -- Prize pool = entry_fee * size
    v_prize := v_tournament.entry_fee * v_tournament.size;

    -- Atomic credit to winner
    update public.profiles set balance = balance + v_prize, updated_at = now()
      where id = v_winner returning balance into v_balance;

    -- Immutable ledger entry (once)
    insert into public.coin_transactions (player_id, amount, balance_after, type, reference_id)
    values (v_winner, v_prize, v_balance, 'tournament_prize', v_match.tournament_id);

    -- Complete tournament + winner + stats
    update public.tournaments
       set status = 'completed', winner_id = v_winner, current_players = v_tournament.current_players,
           updated_at = now()
     where id = v_match.tournament_id;

    update public.profiles
       set tournament_wins = tournament_wins + 1, updated_at = now()
     where id = v_winner;
  end if;
end; $$;

-- 5. get_tournament_matches helper (ordered, with players)
create or replace function public.get_tournament_matches(p_tournament_id uuid)
returns table (
  id uuid, round integer, match_index integer, status text, winner_id uuid,
  player1_id uuid, player2_id uuid, player1_score integer, player2_score integer,
  is_draw boolean
)
language sql security definer set search_path = public as $$
  select id, round, match_index, status, winner_id, player1_id, player2_id, player1_score, player2_score, is_draw
  from public.tournament_matches
  where tournament_id = p_tournament_id
  order by round asc, match_index asc;
$$;