alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_key on public.profiles (username);

update public.profiles p
set username = nullif(btrim(u.raw_user_meta_data ->> 'username'), '')
from auth.users u
where p.id = u.id
  and nullif(btrim(p.username), '') is null
  and nullif(btrim(u.raw_user_meta_data ->> 'username'), '') is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, email, display_name, user_type)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    coalesce(new.raw_user_meta_data ->> 'user_type', '휠체어')
  )
  on conflict (id) do update
  set username = coalesce(nullif(btrim(public.profiles.username), ''), excluded.username),
      email = excluded.email,
      display_name = coalesce(public.profiles.display_name, excluded.display_name),
      user_type = coalesce(public.profiles.user_type, excluded.user_type);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
notify pgrst, 'reload schema';
