create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references categories (id) on delete set null,
  youtube_url text not null,
  video_id text not null,
  title text not null,
  thumbnail_url text not null,
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  raw_transcript text,
  created_at timestamptz not null default now()
);

alter table categories enable row level security;
alter table recipes enable row level security;

create policy "Users manage their own categories"
  on categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own recipes"
  on recipes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index recipes_user_id_idx on recipes (user_id);
create index recipes_category_id_idx on recipes (category_id);
create index categories_user_id_idx on categories (user_id);
