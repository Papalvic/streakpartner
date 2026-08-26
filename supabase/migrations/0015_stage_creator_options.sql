-- ============================================================
-- StreakPartner Stage 15: Creator options (participate toggle + password-protected tournaments)
--   * Creator can choose whether to participate (default: not participating).
--   * Tournaments can be password-protected (only those with the pass key can join).
-- ============================================================

-- Enable pgcrypto for secure password hashing.
create extension if not exists pgcrypto;

-- ============================================================
-- 1. TOURNAMENTS: add password columns (never expose the plaintext)
-- ============================================================
alter table public.tournaments
  add column if not exists password_hash text,
  add column if not exists requires_password boolean not null default false;

-- ============================================================
-- 2. create_tournament: optional creator participation + optional password
-- ============================================================
create or replace function public.create_tournament(
  p_name text,
  p_size integer,
  p_entry_fee integer default 5,
  p_creator_participates boolean default false,
  p_password text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_creator_id uuid := auth.uid();
  v_new_balance integer;
  v_tournament_id uuid;
  v_password_hash text := null;
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

  -- Optional password protection
  if p_password is not null and length(trim(p_password)) = 0 then
    p_password := null;
  end if;
  if p_password is not null and length(p_password) < 4 then
    raise exception 'Tournament password must be at least 4 characters';
  end if;
  if p_password is not null then
    v_password_hash := crypt(p_password, gen_salt('bf'));
  end if;

  -- Only debit the creator if they choose to participate
  if p_creator_participates then
    update public.profiles
       set balance = balance - p_entry_fee,
           updated_at = now()
     where id = v_creator_id
       and balance >= p_entry_fee
     returning balance into v_new_balance;

    if v_new_balance is null then
      raise exception 'Insufficient PromptCoin balance';
    end if;

    insert into public.coin_transactions (player_id, amount, balance_after, type, reference_id)
    values (v_creator_id, -p_entry_fee, v_new_balance, 'match_stake', null);
  end if;

  -- Create the tournament (creator is NOT a participant unless they opted in)
  insert into public.tournaments (name, size, entry_fee, creator_id, current_players, password_hash, requires_password)
  values (
    trim(p_name),
    p_size,
    p_entry_fee,
    v_creator_id,
    case when p_creator_participates then 1 else 0 end,
    v_password_hash,
    v_password_hash is not null
  )
  returning id into v_tournament_id;

  -- If the creator participates, link their stake txn + add them as seed 1
  if p_creator_participates then
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

    insert into public.tournament_participants (tournament_id, player_id, seed)
    values (v_tournament_id, v_creator_id, 1);
  end if;

  return v_tournament_id;
end;
$$;

-- ============================================================
-- 3. join_tournament: verify password if the tournament is protected
-- ============================================================
create or replace function public.join_tournament(p_tournament_id uuid, p_password text default null)
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

  -- Password-protected tournaments require the correct pass key
  if v_tournament.requires_password or v_tournament.password_hash is not null then
    if p_password is null or length(trim(p_password)) = 0
       or v_tournament.password_hash is distinct from crypt(p_password, v_tournament.password_hash) then
      raise exception 'Incorrect tournament password';
    end if;
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
    update public.tournaments
       set status = 'in_progress',
           updated_at = now()
     where id = p_tournament_id;

    perform public.generate_tournament_bracket(p_tournament_id);
  end if;
end;
$$;