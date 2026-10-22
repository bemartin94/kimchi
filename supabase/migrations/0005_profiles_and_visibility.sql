-- Profiles: one row per user, extending auth.users (which app migrations
-- shouldn't alter directly). is_public gates whether OTHER signed-in users
-- can browse this person's whole recipe collection. Private stays private
-- except for whatever they explicitly share via share_token (see 0004).

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Any signed-in user can see that a profile exists (name, public/private
-- status) -- needed to browse/discover public users. Content (recipes) is
-- gated separately below, not here.
create policy "Profiles are viewable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

create policy "Users insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row on signup.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill profiles for any accounts created before this migration.
insert into public.profiles (id, display_name)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- Recipes/categories: split the old "owner does everything" policy so SELECT
-- can also allow rows owned by a user whose profile is public, while writes
-- stay owner-only.
drop policy "Users manage their own recipes" on recipes;

create policy "View own or public-profile recipes"
  on recipes for select
  using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = recipes.user_id and p.is_public = true)
  );

create policy "Insert own recipes" on recipes for insert with check (auth.uid() = user_id);
create policy "Update own recipes" on recipes for update using (auth.uid() = user_id);
create policy "Delete own recipes" on recipes for delete using (auth.uid() = user_id);

drop policy "Users manage their own categories" on categories;

create policy "View own or public-profile categories"
  on categories for select
  using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = categories.user_id and p.is_public = true)
  );

create policy "Insert own categories" on categories for insert with check (auth.uid() = user_id);
create policy "Update own categories" on categories for update using (auth.uid() = user_id);
create policy "Delete own categories" on categories for delete using (auth.uid() = user_id);
