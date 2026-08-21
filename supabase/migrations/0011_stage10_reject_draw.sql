-- Stage 10: secure challenge rejection + refund RPC (atomic, idempotent, lock).
Create or replace function public.reject_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_m record; v_new_bal integer;
begin
  -- authenticated
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  -- lock row
  select * into v_m from public.matches where id = p_match_id for update;
  if v_m.id is null then raise exception 'Match not found'; end if;
  -- must be pending
  if v_m.status <> 'pending' then raise exception 'Only pending challenges can be rejected'; end if;
  -- must be opponent (receiver) rejecting; challenger cannot reject own
  if auth.uid() <> v_m.opponent_id then raise exception 'Only the opponent can reject this challenge'; end if;
  -- atomic refund to challenger
  update public.profiles set balance = balance + v_m.stake where id = v_m.challenger_id returning balance into v_new_bal;
  -- record refund once
  insert into public.coin_transactions (player_id,amount,balance_after,type,reference_id)
  values (v_m.challenger_id, v_m.stake, v_new_bal, 'match_refund', v_m.id);
  -- permanently cancel (never settleable/reopenable/appears in active/pending UI)
  update public.matches set status='cancelled', settled=true, updated_at=now() where id = p_match_id;
  -- notify challenger
  perform public.notify_user(v_m.challenger_id,'match','Challenge Rejected',
    (select '@'||username||' rejected your match challenge. Your '||v_m.stake||' PromptCoin stake has been returned.' from public.profiles where id = auth.uid()),
    v_m.id);
end; $$;