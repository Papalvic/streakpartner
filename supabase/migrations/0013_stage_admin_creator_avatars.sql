-- Auto-assign distinct avatars when role/permission changes.

-- When a user becomes admin => admin-1 (lion). Back to gamer-1 if demoted.
drop policy if exists "profiles_admin_update" on public.profiles;

-- Ensure creator grants set the creator avatar.
create or replace function public.admin_set_tournament_permission(p_user_id uuid, p_can boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then raise exception 'Admin only'; end if;
  if p_user_id is null then raise exception 'User required'; end if;
  update public.profiles
     set can_create_tournaments = p_can,
         avatar_id = case when p_can then 'creator-1' else 'gamer-1' end,
         updated_at = now()
   where id = p_user_id;
end; $$;

-- Admin role changes also assign the admin avatar.
create or replace function public.admin_set_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then raise exception 'Admin only'; end if;
  if p_role not in ('user','admin') then raise exception 'Invalid role'; end if;
  update public.profiles
     set role = p_role,
         avatar_id = case when p_role = 'admin' then 'admin-1' else 'gamer-1' end,
         updated_at = now()
   where id = p_user_id;
end; $$;