-- ============================================================
-- StreakPartner Stage 5: Social Feed + Avatars
-- Follows the secure RLS + server-writes pattern of prior stages.
-- ============================================================

-- ============================================================
-- 1. PROFILES: add avatar_id column
-- ============================================================
alter table public.profiles
  add column if not exists avatar_id text;

-- Default avatar for all existing users
update public.profiles
   set avatar_id = 'gamer-1'
 where avatar_id is null;

-- New users get the default avatar via the existing trigger (add here)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, balance, avatar_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'player_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username', 'Player'),
    1000,
    'gamer-1'
  );

  insert into public.coin_transactions (player_id, amount, balance_after, type, reference_id)
  values (new.id, 1000, 1000, 'signup_bonus', new.id);

  return new;
end;
$$;

-- ============================================================
-- 2. SOCIAL POSTS
-- ============================================================
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (length(content) > 0 and length(content) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists social_posts_created_idx
  on public.social_posts (created_at desc);

-- ============================================================
-- 3. POST COMMENTS
-- ============================================================
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (length(content) > 0 and length(content) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_idx
  on public.post_comments (post_id, created_at asc);

-- ============================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================
alter table public.social_posts enable row level security;
alter table public.post_comments enable row level security;

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

-- POSTS: any authenticated user can read
create policy "social_posts_select" on public.social_posts
  for select using (auth.uid() is not null);

-- POSTS: authenticated users can insert their own posts
create policy "social_posts_insert_own" on public.social_posts
  for insert with check (auth.uid() = user_id);

-- POSTS: users can delete only their own posts
create policy "social_posts_delete_own" on public.social_posts
  for delete using (auth.uid() = user_id);

-- COMMENTS: any authenticated user can read
create policy "post_comments_select" on public.post_comments
  for select using (auth.uid() is not null);

-- COMMENTS: authenticated users can insert their own comments
create policy "post_comments_insert_own" on public.post_comments
  for insert with check (auth.uid() = user_id);

-- COMMENTS: users can delete only their own comments
create policy "post_comments_delete_own" on public.post_comments
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 6. ENABLE REALTIME
-- ============================================================
alter publication supabase_realtime add table public.social_posts;
alter publication supabase_realtime add table public.post_comments;