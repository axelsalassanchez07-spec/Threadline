-- THREADLINE Supabase Cloud Sync — starter schema, V1.3
-- Run once in Supabase -> SQL Editor -> New query.
-- This is designed for the personal, single-user THREADLINE website.
-- IMPORTANT: create a PRIVATE Storage bucket named `threadline-images` in
-- Storage -> New bucket. Do not make your clothing photos publicly accessible.

-- One row per signed-in user. For the first cloud version, the JSON value
-- holds wardrobe, inspiration, saved looks, style feedback and preferences.
-- Clothing/inspiration photos must be uploaded to Storage and referred to by
-- a private object path; do NOT save base64-encoded photos in this JSON.
create table if not exists public.threadline_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.threadline_state enable row level security;
revoke all on public.threadline_state from anon;
grant select, insert, update, delete on public.threadline_state to authenticated;

-- Each authenticated person may read/change only their own record.
drop policy if exists "threadline_read_own_state" on public.threadline_state;
create policy "threadline_read_own_state"
on public.threadline_state for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "threadline_insert_own_state" on public.threadline_state;
create policy "threadline_insert_own_state"
on public.threadline_state for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "threadline_update_own_state" on public.threadline_state;
create policy "threadline_update_own_state"
on public.threadline_state for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "threadline_delete_own_state" on public.threadline_state;
create policy "threadline_delete_own_state"
on public.threadline_state for delete to authenticated
using ((select auth.uid()) = user_id);

-- The 'threadline-images' bucket must be PRIVATE and photos must be uploaded
-- under a user-specific prefix: <signed-in-user-id>/<random-name>.jpg .
-- Using the Storage API for uploads/deletions (not direct SQL) is essential.
drop policy if exists "threadline_read_own_images" on storage.objects;
create policy "threadline_read_own_images"
on storage.objects for select to authenticated
using (
  bucket_id = 'threadline-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "threadline_insert_own_images" on storage.objects;
create policy "threadline_insert_own_images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'threadline-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "threadline_update_own_images" on storage.objects;
create policy "threadline_update_own_images"
on storage.objects for update to authenticated
using (
  bucket_id = 'threadline-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'threadline-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "threadline_delete_own_images" on storage.objects;
create policy "threadline_delete_own_images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'threadline-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);