-- THREADLINE V1.5 isolated cloud test — run in Supabase SQL Editor.
-- This table is separate from production `public.threadline_state`; it does NOT modify or clear production data.
-- Preview users can read/write only their own test row.
create table if not exists public.threadline_v15_test_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.threadline_v15_test_state enable row level security;
revoke all on public.threadline_v15_test_state from anon;
grant select, insert, update, delete on public.threadline_v15_test_state to authenticated;

drop policy if exists "threadline_v15_test_read_own" on public.threadline_v15_test_state;
create policy "threadline_v15_test_read_own" on public.threadline_v15_test_state
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "threadline_v15_test_insert_own" on public.threadline_v15_test_state;
create policy "threadline_v15_test_insert_own" on public.threadline_v15_test_state
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "threadline_v15_test_update_own" on public.threadline_v15_test_state;
create policy "threadline_v15_test_update_own" on public.threadline_v15_test_state
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "threadline_v15_test_delete_own" on public.threadline_v15_test_state;
create policy "threadline_v15_test_delete_own" on public.threadline_v15_test_state
for delete to authenticated using ((select auth.uid()) = user_id);

-- Reuse existing PRIVATE Storage bucket `threadline-images` and its user-folder RLS;
-- preview uploads use `<user-id>/v15-test/... ` subpaths, not production image paths.
-- No bucket or other SQL changes needed.
