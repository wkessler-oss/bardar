
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles viewable by authenticated" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

-- reports
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null,
  place_name text not null,
  lat double precision not null,
  lng double precision not null,
  crowd_level smallint not null check (crowd_level between 1 and 4),
  wait_minutes smallint check (wait_minutes between 0 and 240),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "reports viewable by authenticated" on public.reports for select to authenticated using (true);
create policy "users insert own reports" on public.reports for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own reports" on public.reports for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own reports" on public.reports for delete to authenticated using (auth.uid() = user_id);

create index reports_place_id_created_at_idx on public.reports (place_id, created_at desc);
create index reports_created_at_idx on public.reports (created_at desc);

-- profile auto-create on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, ''), '@', 1),
      'Bar Hopper'
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
