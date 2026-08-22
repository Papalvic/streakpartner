-- Stage: Reports + Admin (roles, tournament-create permission, bans)
-- Profiles: role + tournament permission + ban flag
alter table public.profiles add column if not exists role text not null default 'user' check (role in ('user','admin'));
alter table public.profiles add column if not exists can_create_tournaments boolean not null default false;
alter table public.profiles add column if not exists is_banned boolean not null default false;

-- Reports table (with optional image url)
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (length(reason) between 5 and 2000),
  image_url text,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "reports_insert_own" on public.reports for insert with check (auth.uid() = reporter_id);
create policy "reports_select_own_or_admin" on public.reports for select using (
  auth.uid() = reporter_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Allow admins to update report status
create policy "reports_update_admin" on public.reports for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Secure: report a user (validates reported user exists, self-report blocked)
create or replace function public.create_report(p_reported uuid, p_reason text, p_image_url text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_reported is null then raise exception 'Reported user required'; end if;
  if p_reported = auth.uid() then raise exception 'You cannot report yourself'; end if;
  if p_reason is null or length(trim(p_reason)) < 5 then raise exception 'Reason too short'; end if;
  if not exists (select 1 from public.profiles where id = p_reported) then raise exception 'User not found'; end if;
  insert into public.reports (reporter_id, reported_user_id, reason, image_url)
  values (auth.uid(), p_reported, trim(p_reason), p_image_url);
end; $$;

-- Admin: ban/unban a user
create or replace function public.admin_set_banned(p_user_id uuid, p_banned boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then raise exception 'Admin only'; end if;
  if p_user_id is null then raise exception 'User required'; end if;
  update public.profiles set is_banned = p_banned, updated_at = now() where id = p_user_id;
end; $$;

-- Admin: toggle tournament-create permission
create or replace function public.admin_set_tournament_permission(p_user_id uuid, p_can boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then raise exception 'Admin only'; end if;
  if p_user_id is null then raise exception 'User required'; end if;
  update public.profiles set can_create_tournaments = p_can, updated_at = now() where id = p_user_id;
end; $$;

-- Block banned users from logging in (signIn guard)
create or replace function public.is_banned(p_user_id uuid) returns boolean
language sql security definer set search_path = public as $$
  select is_banned from public.profiles where id = p_user_id;
$$;
</content>
<path>supabase/migrations/0012_stage_admin_reports.sql</path>
<task_progress>
- [x] Inspect profiles schema
- [x] Migration 0012: role, can_create_tournaments, is_banned, reports table + RLS + admin RPCs + is_banned helper
- [ ] Enforce tournament creation permission (createTournament action + RPC)
- [ ] Enforce login ban (auth login action checks is_banned)
- [ ] Public profile report form (reason + optional image)
- [ ] Admin page (reports paginated + users paginated/searchable + ban + permission)
- [ ] Run build
</task_progress>