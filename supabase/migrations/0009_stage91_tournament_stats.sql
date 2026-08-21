-- 1. Add tournament_matches_played (count of resolved tournament bracket matches).
alter table public.profiles add column if not exists tournament_matches_played integer not null default 0;

-- 2. Rewrite submit_tournament_match_result:
--    resolved (win/loss) => +1 tournament_matches_played
--    draw/replay => NO increment
--    tournament matches do NOT touch normal matches_played/wins/losses
drop function if exists public.submit_tournament_match_result(uuid,integer,integer,text);

create or replace function public.submit_tournament_match_result(
  p_match_id uuid, p_player1_score integer, p_player2_score integer, p_screenshot_url text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_t record; v_m record; v_w uuid; v_prize integer; v_bal integer; v_slot integer; v_loser uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_player1_score is null or p_player2_score is null or p_player1_score<0 or p_player2_score<0 then raise exception 'Scores must be non-negative integers'; end if;
  if p_screenshot_url is null or p_screenshot_url = '' then raise exception 'Screenshot proof is required for tournament matches'; end if;

  select * into v_m from public.tournament_matches where id=p_match_id for update;
  if v_m.id is null then raise exception 'Tournament match not found'; end if;
  select * into v_t from public.tournaments where id=v_m.tournament_id for update;
  if v_t.id is null then raise exception 'Tournament not found'; end if;
  if v_m.status='completed' then raise exception 'Tournament match already settled'; end if;
  if v_m.status='bye' then raise exception 'Match is a bye'; end if;
  if auth.uid() not in (v_m.player1_id,v_m.player2_id) then raise exception 'Only tournament match participants can submit results'; end if;

  if p_player1_score>p_player2_score then v_w:=v_m.player1_id;
  elsif p_player2_score>p_player1_score then v_w:=v_m.player2_id; end if;

  update public.tournament_matches
     set player1_score=p_player1_score, player2_score=p_player2_score,
         is_draw=(v_w is null), screenshot_url=coalesce(p_screenshot_url,screenshot_url),
         winner_id=v_w,
         status=case when v_w is null then 'pending' else 'completed' end,
         updated_at=now()
   where id=p_match_id;

  if v_w is null then return; end if; -- DRAW -> replay, NO stat increment

  -- Advance winner into next round
  if v_m.round+1 <= (select log(2,v_t.size::numeric)::integer) then
    v_slot := (v_m.match_index % 2)+1;
    if v_slot=1 then
      update public.tournament_matches set player1_id=v_w
        where tournament_id=v_m.tournament_id and round=v_m.round+1 and match_index=floor(v_m.match_index/2);
    else
      update public.tournament_matches set player2_id=v_w
        where tournament_id=v_m.tournament_id and round=v_m.round+1 and match_index=floor(v_m.match_index/2);
    end if;
  end if;

  -- Resolved tournament match: +1 tournament_matches_played to BOTH participants only.
  v_loser := case when v_w=v_m.player1_id then v_m.player2_id else v_m.player1_id end;
  update public.profiles set tournament_matches_played=tournament_matches_played+1 where id in (v_w, v_loser);

  -- Final: complete + pay prize + tournament_wins
  if v_m.round = (select log(2,v_t.size::numeric)::integer) then
    if v_t.status='completed' then raise exception 'Tournament already completed'; end if;
    v_prize := v_t.entry_fee * v_t.size;
    update public.profiles set balance=balance+v_prize where id=v_w returning balance into v_bal;
    insert into public.coin_transactions (player_id,amount,balance_after,type,reference_id)
      values (v_w,v_prize,v_bal,'tournament_prize',v_m.tournament_id);
    update public.tournaments set status='completed', winner_id=v_w where id=v_m.tournament_id;
    update public.profiles set tournament_wins=tournament_wins+1 where id=v_w;
  end if;
end; $$;

-- 3. Canonical stats view: expose tournament_matches_played
drop view if exists public.player_stats;
create or replace view public.player_stats as
select p.id as player_id, p.username, p.display_name, p.avatar_id,
       p.balance, p.matches_played, p.tournament_matches_played, p.wins, p.losses, p.tournament_wins,
       case when p.matches_played>0 then round((p.wins::numeric/p.matches_played)*100) else 0 end as win_rate
from public.profiles p;