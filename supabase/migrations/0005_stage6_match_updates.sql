-- StreakPartner Stage 6 Update: flexible result, draws, challenge codes, optional screenshot, match chat.

-- 1. Matches: challenge_code column (unique)
alter table public.matches add column if not exists challenge_code text;
update public.matches set challenge_code = upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)) where challenge_code is null;
alter table public.matches add constraint matches_challenge_code_unique unique (challenge_code);
alter table public.matches alter column challenge_code set not null;

create or replace function public.generate_match_code() returns text language sql immutable as $$
  select upper(substring(translate(gen_random_uuid()::text,'abcdefghijklmnpqrstuvwxyz0123456789abcdef','ABCDEFGHJKMNPQRSTUVWXYZ23456789'),1,6));
$$;

-- 2. Coin transactions: allow match_refund
alter table public.coin_transactions drop constraint if exists coin_transactions_type_check;
alter table public.coin_transactions add constraint coin_transactions_type_check check (type in ('signup_bonus','match_stake','match_winnings','match_refund'));

-- 3. Match results: optional winner/screenshot, add is_draw
alter table public.match_results alter column winner_id drop not null;
alter table public.match_results alter column screenshot_url drop not null;
alter table public.match_results add column if not exists is_draw boolean not null default false;

-- 4. Match chat (participants only)
create table if not exists public.match_chat_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (length(content) > 0 and length(content) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists match_chat_match_idx on public.match_chat_messages (match_id, created_at asc);
alter table public.match_chat_messages enable row level security;

create policy "match_chat_select" on public.match_chat_messages for select using (
  auth.uid() is not null and exists (select 1 from public.matches m where m.id = match_chat_messages.match_id and (m.challenger_id = auth.uid() or m.opponent_id = auth.uid()))
);
create policy "match_chat_insert" on public.match_chat_messages for insert with check (
  auth.uid() = user_id and exists (select 1 from public.matches m where m.id = match_chat_messages.match_id and (m.challenger_id = auth.uid() or m.opponent_id = auth.uid()))
);
create policy "match_chat_delete" on public.match_chat_messages for delete using (auth.uid() = user_id);

-- 5. settle_match: flexible submitter (participant), draws, optional screenshot, atomic refunds
drop function if exists public.settle_match(uuid,uuid,integer,integer,text);
create or replace function public.settle_match(
  p_match_id uuid, p_challenger_score integer, p_opponent_score integer, p_screenshot_url text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_match record; v_expense integer; v_winner uuid := null; v_a integer; v_b integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_challenger_score is null or p_opponent_score is null or p_challenger_score < 0 or p_opponent_score < 0
    then raise exception 'Scores must be non-negative integers'; end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if v_match.id is null then raise exception 'Match not found'; end if;
  if v_match.status <> 'accepted' then raise exception 'Match must be accepted before settlement'; end if;
  if v_match.settled then raise exception 'Match already settled'; end if;
  if auth.uid() not in (v_match.challenger_id, v_match.opponent_id)
    then raise exception 'Only match participants can submit results'; end if;

  v_expense := v_match.stake;
  if p_challenger_score > p_opponent_score then v_winner := v_match.challenger_id;
  elsif p_opponent_score > p_challenger_score then v_winner := v_match.opponent_id; end if;

  if v_winner is null then
    -- DRAW: refund both
    update public.profiles set balance = balance + v_expense, updated_at = now() where id = v_match.challenger_id returning balance into v_a;
    update public.profiles set balance = balance + v_expense, updated_at = now() where id = v_match.opponent_id returning balance into v_b;
    insert into public.coin_transactions values (gen_random_uuid(), v_match.challenger_id, v_expense, v_a, 'match_refund', p_match_id, now());
    insert into public.coin_transactions values (gen_random_uuid(), v_match.opponent_id, v_expense, v_b, 'match_refund', p_match_id, now());
    insert into public.match_results (match_id, winner_id, challenger_score, opponent_score, screenshot_url, submitted_by, is_draw)
      values (p_match_id, null, p_challenger_score, p_opponent_score, p_screenshot_url, auth.uid(), true);
    update public.matches set status='completed', winner_id=null, settled=true, updated_at=now() where id=p_match_id;
    update public.profiles set matches_played = matches_played + 1, updated_at = now() where id in (v_match.challenger_id, v_match.opponent_id);
  else
    -- WIN
    update public.profiles set balance = balance + (v_match.stake * 2), updated_at = now() where id = v_winner returning balance into v_a;
    update public.profiles set balance = balance - v_match.stake, matches_played = matches_played + 1, losses = losses + 1, updated_at = now()
      where id = case when v_winner = v_match.challenger_id then v_match.opponent_id else v_match.challenger_id end returning balance into v_b;
    update public.profiles set matches_played = matches_played + 1, wins = wins + 1, updated_at = now() where id = v_winner;
    insert into public.coin_transactions values (gen_random_uuid(), v_winner, (v_match.stake * 2), v_a, 'match_winnings', p_match_id, now());
    insert into public.match_results (match_id, winner_id, challenger_score, opponent_score, screenshot_url, submitted_by, is_draw)
      values (p_match_id, v_winner, p_challenger_score, p_opponent_score, p_screenshot_url, auth.uid(), false);
    update public.matches set status='completed', winner_id=v_winner, settled=true, updated_at=now() where id=p_match_id;
  end if;
end; $$;

-- 6. create_match: generate unique challenge_code
drop function if exists public.create_match(uuid);
create or replace function public.create_match(p_opponent_id uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := auth.uid(); v_stake integer := 5; v_bal integer; v_match uuid; v_code text;
begin
  if v_id is null then raise exception 'Not authenticated'; end if;
  if v_id = p_opponent_id then raise exception 'Cannot challenge yourself'; end if;
  if not exists (select 1 from public.profiles where id = p_opponent_id) then raise exception 'Opponent does not exist'; end if;
  loop
    v_code := public.generate_match_code();
    exit when not exists (select 1 from public.matches where challenge_code = v_code);
  end loop;
  update public.profiles set balance = balance - v_stake, updated_at = now() where id = v_id and balance >= v_stake returning balance into v_bal;
  if v_bal is null then raise exception 'Insufficient PromptCoin balance'; end if;
  insert into public.coin_transactions values (gen_random_uuid(), v_id, -v_stake, v_bal, 'match_stake', null, now());
  insert into public.matches (challenger_id, opponent_id, stake, challenge_code) values (v_id, p_opponent_id, v_stake, v_code) returning id into v_match;
  update public.coin_transactions set reference_id = v_match where player_id = v_id and type='match_stake' and reference_id is null and created_at = (select max(created_at) from public.coin_transactions where player_id = v_id and type='match_stake' and reference_id is null);
  return v_match;
end; $$;

-- 7. find_match_by_code: return pending match id for the code (server-security checks)
create or replace function public.find_match_by_code(p_code text) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := auth.uid(); v_match uuid; v_status text; v_challenger uuid;
begin
  if v_id is null then raise exception 'Not authenticated'; end if;
  select id, status, challenger_id into v_match, v_status, v_challenger from public.matches where upper(trim(p_code)) = challenge_code;
  if v_match is null then raise exception 'Challenge not found'; end if;
  if v_status <> 'pending' then raise exception 'Challenge is not pending'; end if;
  if v_challenger = v_id then raise exception 'You cannot join your own challenge'; end if;
  return v_match;
end; $$;