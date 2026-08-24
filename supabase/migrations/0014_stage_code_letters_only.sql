-- Challenge codes: exactly 6 random LETTERS only (A-Z), no dash/symbol/number.
create or replace function public.generate_match_code() returns text
language sql immutable as $$
  select left(string_agg(substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 1+(random()*26)::int, 1), ''), 6);
$$;

-- Referral codes: exactly 6 random LETTERS only (A-Z), no dash/symbol/number.
create or replace function public.generate_referral_code() returns text
language sql immutable as $$
  select left(string_agg(substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 1+(random()*26)::int, 1), ''), 6);
$$;

-- Normalize existing codes: strip any dash/space, keep uppercase (length may remain legacy-7).
update public.matches set challenge_code = upper(replace(replace(challenge_code, '-', ''), ' ', ''))
  where challenge_code is not null and challenge_code <> upper(replace(replace(challenge_code, '-', ''), ' ', ''));
update public.profiles set referral_code = upper(replace(replace(referral_code, '-', ''), ' ', ''))
  where referral_code is not null and referral_code <> upper(replace(replace(referral_code, '-', ''), ' ', ''));