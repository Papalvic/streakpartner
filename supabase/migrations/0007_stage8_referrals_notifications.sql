-- StreakPartner Stage 8: Referrals + Social Connections + Notifications
-- Server-side rewards only. RLS preserved.

-- 1. Allow referral_bonus transaction type
alter table public.coin_transactions drop constraint if exists coin_transactions_type_check;
alter table public.coin_transactions add constraint coin_transactions_type_check
  check (type in ('signup_bonus','match_stake','match_winnings','match_refund','tournament_prize','referral_bonus'));

-- 2. Profiles: referral_code column (unique, unambiguous)
alter table public.profiles add column if not exists referral_code text;
create unique index if not exists profiles_referral_code_unique on public.profiles (referral_code);

-- Backfill existing users with a code if missing
create or replace function public.generate_referral_code()
returns text language sql immutable as $$
  select upper(substring(translate(gen_random_uuid()::text,'abcdefghijklmnpqrstuvwxyz0123456789abcdef','ABCDEFGHJKMNPQRSTUVWXYZ23456789'),1,7));
$$;

do $$
declare r record;
begin
  for r in select id from public.profiles where referral_code is null loop
    update public.profiles set referral_code = public.generate_referral_code() where id = r.id;
  end loop;
end $$;

-- Ensure handle_new_user assigns a referral_code to new profiles
drop trigger if exists on_auth_user_created on auth.users;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  -- generate a unique code
  loop
    v_code := public.generate_referral_code();
    exit when not exists (select 1 from public.profiles where referral_code = v_code);
  end loop;

  insert into public.profiles (id, username, display_name, balance, avatar_id, referral_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'player_' || substr(new.id::text,1,8)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username', 'Player'),
    1000,
    'gamer-1',
    v_code
  );

  insert into public.coin_transactions (player_id, amount, balance_after, type, reference_id)
  values (new.id, 1000, 1000, 'signup_bonus', new.id);

  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Referrals table
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_user_id uuid not null unique references public.profiles (id) on delete cascade,
  referral_code text not null,
  created_at timestamptz not null default now()
);
alter table public.referrals enable row level security;
create policy "referrals_select_own" on public.referrals for select using (auth.uid() = referrer_id or auth.uid() = referred_user_id);
create policy "referrals_select_public" on public.referrals for select using (auth.uid() is not null);

-- 4. Notifications table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text,
  title text,
  message text,
  related_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id);
create policy "notifications_delete_own" on public.notifications for delete using (auth.uid() = user_id);

-- NOTIFICATION GENERATION FUNCTION (security definer, called from secure triggers/actions)
create or replace function public.notify_user(p_user_id uuid, p_type text, p_title text, p_message text, p_related_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, title, message, related_id)
  values (p_user_id, p_type, p_title, p_message, p_related_id);
end $$;

-- 5. REFERRAL PROCESSING (atomic, idempotent, secure)
create or replace function public.process_referral(p_new_user_id uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_referrer uuid;
  v_referrer_balance integer;
  v_referred_balance integer;
begin
  if p_new_user_id is null or p_code is null then return; end if;

  select id into v_referrer from public.profiles where referral_code = upper(trim(p_code));
  if v_referrer is null then return; end if;  -- invalid code: no bonus
  if v_referrer = p_new_user_id then return; end if; -- cannot refer self

  -- Insert referral row (UNIQUE referred_user_id prevents double rewards)
  insert into public.referrals (referrer_id, referred_user_id, referral_code)
  values (v_referrer, p_new_user_id, upper(trim(p_code)))
  on conflict (referred_user_id) do nothing
  returning referrer_id into v_referrer;

  if v_referrer is null then return; end if; -- already referred (idempotent)

  -- Atomic: credit referrer +50
  update public.profiles set balance = balance + 50, updated_at = now()
    where id = v_referrer returning balance into v_referrer_balance;

  -- Atomic: credit new user +50
  update public.profiles set balance = balance + 50, updated_at = now()
    where id = p_new_user_id returning balance into v_referred_balance;

  -- Immutable ledger rows (both or nothing visually—ledger rows are part of same tx)
  insert into public.coin_transactions (player_id, amount, balance_after, type, reference_id)
  values (v_referrer, 50, v_referrer_balance, 'referral_bonus', v_referrer);

  insert into public.coin_transactions (player_id, amount, balance_after, type, reference_id)
  values (p_new_user_id, 50, v_referred_balance, 'referral_bonus', p_new_user_id);

  -- Referral notifications
  perform public.notify_user(v_referrer, 'referral', 'Referral Bonus',
    (select '@' || username || ' joined using your invitation code. You received +50 PromptCoin.' from public.profiles where id = p_new_user_id));

  perform public.notify_user(p_new_user_id, 'referral', 'Referral Bonus',
    'You received +50 PromptCoin for joining with an invitation code.');
end $$;

-- 6. MATCH NOTIFICATION TRIGGERS
create or replace function public.on_match_challenged() returns trigger language plpgsql security definer set search_path = public as $$
declare v_username text;
begin
  select username into v_username from public.profiles where id = new.challenger_id;
  perform public.notify_user(new.opponent_id, 'match', 'New Match Challenge',
    '@' || coalesce(v_username,'player') || ' challenged you to a 1v1 match.', new.id);
  return new;
end $$;
create trigger match_challenged_trigger after insert on public.matches
  for each row when (new.status = 'pending') execute function public.on_match_challenged();

create or replace function public.on_match_accepted() returns trigger language plpgsql security definer set search_path = public as $$
declare v_username text;
begin
  select username into v_username from public.profiles where id = new.opponent_id;
  perform public.notify_user(new.challenger_id, 'match', 'Challenge Accepted',
    '@' || coalesce(v_username,'player') || ' accepted your match challenge.', new.id);
  return new;
end $$;
create trigger match_accepted_trigger after update on public.matches
  for each row when (new.status = 'accepted' and old.status = 'pending') execute function public.on_match_accepted();

-- 7. TOURNAMENT NOTIFICATION TRIGGERS
create or replace function public.on_tournament_match_update() returns trigger language plpgsql security definer set search_path = public as $$
declare v_match record; v_username text; v_tname text; v_prize integer; v_tournament record;
begin
  if new.round = 1 and old.player1_id is null and new.player1_id is not null then
    -- round 1 assignment
    select username into v_username from public.profiles where id = new.player2_id;
    perform public.notify_user(new.player1_id, 'tournament', 'Tournament Match Ready',
      'Your tournament match against @' || coalesce(v_username,'player') || ' is ready.', new.id);
    select username into v_username from public.profiles where id = new.player1_id;
    perform public.notify_user(new.player2_id, 'tournament', 'Tournament Match Ready',
      'Your tournament match against @' || coalesce(v_username,'player') || ' is ready.', new.id);
  end if;

  -- tournament completed (final won)
  if new.status = 'completed' and new.winner_id is not null and new.round = (select log(2,(select size from public.tournaments where id = new.tournament_id)::numeric)::integer) then
    select size, entry_fee, name into v_tournament from public.tournaments where id = new.tournament_id;
    v_prize := v_tournament.entry_fee * v_tournament.size;
    perform public.notify_user(new.winner_id, 'tournament', 'Tournament Champion',
      'You won ' || coalesce(v_tournament.name,'the tournament') || ' and received ' || v_prize || ' PromptCoin.', new.tournament_id);
    -- loser (eliminated)
    perform public.notify_user(case when new.winner_id = new.player1_id then new.player2_id else new.player1_id end, 'tournament', 'Tournament Result',
      'You have been eliminated.', new.tournament_id);
  end if;

  return new;
end $$;
create trigger tournament_match_update_trigger after insert or update on public.tournament_matches
  for each row execute function public.on_tournament_match_update();

-- 8. SAFE REFERRAL CODE APPLICATION (called from signup server action/server-side)
create or replace function public.apply_referral_code(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v_new_user uuid := auth.uid();
begin
  if v_new_user is null then raise exception 'Not authenticated'; end if;
  if p_code is null or trim(p_code) = '' then return 'none'; end if;
  if exists (select 1 from public.referrals where referred_user_id = v_new_user) then
    return 'already'; -- idempotent: no second reward
  end if;
  perform public.process_referral(v_new_user, p_code);
  -- Check whether it actually applied (invalid code -> no referrer row)
  if exists (select 1 from public.referrals where referred_user_id = v_new_user) then
    return 'applied';
  else
    return 'invalid';
  end if;
end $$;