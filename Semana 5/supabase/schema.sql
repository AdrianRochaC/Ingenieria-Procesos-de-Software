create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text not null,
  username text unique not null,
  avatar_url text,
  bio text,
  location text,
  website text,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null,
  image_url text not null,
  category text not null,
  tags text[] not null default '{}',
  likes_count integer not null default 0,
  saves_count integer not null default 0,
  views_count integer not null default 0,
  project_file_name text,
  project_file_size text,
  project_file_type text,
  project_file_path text,
  download_allowed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  likes_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_projects (
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create table if not exists public.user_follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint user_cannot_follow_self check (follower_id <> following_id)
);

create table if not exists public.project_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create table if not exists public.comment_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.comments enable row level security;
alter table public.saved_projects enable row level security;
alter table public.user_follows enable row level security;
alter table public.project_likes enable row level security;
alter table public.comment_likes enable row level security;
alter table public.notifications enable row level security;

create policy "profiles are readable" on public.profiles
for select using (true);

create policy "users manage own profile" on public.profiles
for all using (auth.uid() = id)
with check (auth.uid() = id);

create policy "projects are readable" on public.projects
for select using (true);

create policy "authenticated users create projects" on public.projects
for insert to authenticated
with check (auth.uid() = creator_id);

create policy "owners update own projects" on public.projects
for update to authenticated
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

create policy "owners delete own projects" on public.projects
for delete to authenticated
using (auth.uid() = creator_id);

create policy "comments are readable" on public.comments
for select using (true);

create policy "authenticated users create comments" on public.comments
for insert to authenticated
with check (auth.uid() = user_id);

create policy "comment owners manage comments" on public.comments
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "comment owners delete comments" on public.comments
for delete to authenticated
using (auth.uid() = user_id);

create policy "users read own saves" on public.saved_projects
for select to authenticated
using (auth.uid() = user_id);

create policy "users create own saves" on public.saved_projects
for insert to authenticated
with check (auth.uid() = user_id);

create policy "users delete own saves" on public.saved_projects
for delete to authenticated
using (auth.uid() = user_id);

create policy "likes are readable" on public.project_likes
for select using (true);

create policy "users create own likes" on public.project_likes
for insert to authenticated
with check (auth.uid() = user_id);

create policy "users delete own likes" on public.project_likes
for delete to authenticated
using (auth.uid() = user_id);

create policy "comment likes are readable" on public.comment_likes
for select using (true);

create policy "users create own comment likes" on public.comment_likes
for insert to authenticated
with check (auth.uid() = user_id);

create policy "users delete own comment likes" on public.comment_likes
for delete to authenticated
using (auth.uid() = user_id);

create policy "follows are readable" on public.user_follows
for select using (true);

create policy "users create own follows" on public.user_follows
for insert to authenticated
with check (auth.uid() = follower_id);

create policy "users delete own follows" on public.user_follows
for delete to authenticated
using (auth.uid() = follower_id);

create policy "users read own notifications" on public.notifications
for select to authenticated
using (auth.uid() = recipient_id);

create policy "users update own notifications" on public.notifications
for update to authenticated
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);

create policy "authenticated users create notifications" on public.notifications
for insert to authenticated
with check (auth.uid() = actor_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    username,
    avatar_url
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'creator'), '@', 1)),
    lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, 'creator'), '@', 1)), '[^a-zA-Z0-9_]', '', 'g')),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.update_project_save_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.projects
    set saves_count = saves_count + 1
    where id = new.project_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.projects
    set saves_count = greatest(saves_count - 1, 0)
    where id = old.project_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists saved_projects_count_trigger on public.saved_projects;
create trigger saved_projects_count_trigger
after insert or delete on public.saved_projects
for each row execute procedure public.update_project_save_count();

create or replace function public.update_project_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.projects
    set likes_count = likes_count + 1
    where id = new.project_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.projects
    set likes_count = greatest(likes_count - 1, 0)
    where id = old.project_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists project_likes_count_trigger on public.project_likes;
create trigger project_likes_count_trigger
after insert or delete on public.project_likes
for each row execute procedure public.update_project_like_count();

create or replace function public.update_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments
    set likes_count = likes_count + 1
    where id = new.comment_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.comments
    set likes_count = greatest(likes_count - 1, 0)
    where id = old.comment_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists comment_likes_count_trigger on public.comment_likes;
create trigger comment_likes_count_trigger
after insert or delete on public.comment_likes
for each row execute procedure public.update_comment_like_count();

create or replace function public.increment_project_views(project_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.projects
  set views_count = views_count + 1
  where id = project_id_input;
end;
$$;

create or replace function public.update_follow_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles
    set following_count = following_count + 1
    where id = new.follower_id;

    update public.profiles
    set followers_count = followers_count + 1
    where id = new.following_id;

    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.profiles
    set following_count = greatest(following_count - 1, 0)
    where id = old.follower_id;

    update public.profiles
    set followers_count = greatest(followers_count - 1, 0)
    where id = old.following_id;

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists user_follows_count_trigger on public.user_follows;
create trigger user_follows_count_trigger
after insert or delete on public.user_follows
for each row execute procedure public.update_follow_counts();

-- Storage policies for project-images and project-files
create policy "public can view project images"
on storage.objects
for select
using (bucket_id = 'project-images');

create policy "authenticated users upload project images"
on storage.objects
for insert to authenticated
with check (bucket_id = 'project-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owners update project images"
on storage.objects
for update to authenticated
using (bucket_id = 'project-images' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'project-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owners delete project images"
on storage.objects
for delete to authenticated
using (bucket_id = 'project-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "authenticated users view project files"
on storage.objects
for select to authenticated
using (bucket_id = 'project-files');

create policy "authenticated users upload project files"
on storage.objects
for insert to authenticated
with check (bucket_id = 'project-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owners update project files"
on storage.objects
for update to authenticated
using (bucket_id = 'project-files' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'project-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owners delete project files"
on storage.objects
for delete to authenticated
using (bucket_id = 'project-files' and auth.uid()::text = (storage.foldername(name))[1]);
