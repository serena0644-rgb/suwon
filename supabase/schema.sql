create extension if not exists pgcrypto;

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  email text,
  display_name text,
  user_type text default '휠체어',
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, username, email, display_name, user_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', ''),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    coalesce(new.raw_user_meta_data ->> 'user_type', '휠체어')
  );
  return new;
end;
$$;

create or replace function private.is_admin()
returns boolean
language sql
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.reports enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.reports to anon, authenticated;
grant insert on public.reports to authenticated;
grant update, delete on public.reports to authenticated;
grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or private.is_admin());

drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
on public.profiles for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Approved reports are public" on public.reports;
drop policy if exists "Authenticated users can read reports" on public.reports;
create policy "Approved reports are public"
on public.reports for select
to anon
using (status = 'approved');

create policy "Authenticated users can read reports"
on public.reports for select
to authenticated
using (status = 'approved' or user_id = auth.uid() or private.is_admin());

drop policy if exists "Users can create reports" on public.reports;
create policy "Users can create reports"
on public.reports for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Admins can update reports" on public.reports;
create policy "Admins can update reports"
on public.reports for update
to authenticated
using (exists (
  select 1 where private.is_admin()
))
with check (exists (
  select 1 where private.is_admin()
));

drop policy if exists "Admins can delete reports" on public.reports;
create policy "Admins can delete reports"
on public.reports for delete
to authenticated
using (exists (
  select 1 where private.is_admin()
));

drop function if exists public.is_admin(uuid);

insert into public.reports (user_id, content, status)
select id, '행궁광장 북측 보행로 통행 가능', 'approved'
from auth.users
limit 1
on conflict do nothing;
