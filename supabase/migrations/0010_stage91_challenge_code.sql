-- 0010: normalize challenge codes (applied incrementally)

create or replace function public.generate_match_code() returns text
language sql immutable
as $$
  select upper(
    left(string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1+(random()*31)::int, 1), '')
  ,6));
$$;

update public.matches set challenge_code = upper(replace(challenge_code,'-',''))
  where challenge_code <> upper(replace(challenge_code,'-',''));