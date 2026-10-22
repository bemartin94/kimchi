-- Replace single-category-per-recipe with multiple tags per recipe.

create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table recipe_tags (
  recipe_id uuid not null references recipes (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  primary key (recipe_id, tag_id)
);

alter table tags enable row level security;
alter table recipe_tags enable row level security;

create policy "View own or public-profile tags"
  on tags for select
  using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = tags.user_id and p.is_public = true)
  );

create policy "Insert own tags" on tags for insert with check (auth.uid() = user_id);
create policy "Update own tags" on tags for update using (auth.uid() = user_id);
create policy "Delete own tags" on tags for delete using (auth.uid() = user_id);

-- recipe_tags visibility follows the recipe's own visibility (own, or a public-profile's).
create policy "View recipe_tags for visible recipes"
  on recipe_tags for select
  using (
    exists (
      select 1 from recipes r
      where r.id = recipe_tags.recipe_id
        and (
          r.user_id = auth.uid()
          or exists (select 1 from profiles p where p.id = r.user_id and p.is_public = true)
        )
    )
  );

create policy "Insert own recipe_tags"
  on recipe_tags for insert
  with check (exists (select 1 from recipes r where r.id = recipe_tags.recipe_id and r.user_id = auth.uid()));

create policy "Delete own recipe_tags"
  on recipe_tags for delete
  using (exists (select 1 from recipes r where r.id = recipe_tags.recipe_id and r.user_id = auth.uid()));

create index recipe_tags_recipe_id_idx on recipe_tags (recipe_id);
create index recipe_tags_tag_id_idx on recipe_tags (tag_id);
create index tags_user_id_idx on tags (user_id);

-- Migrate existing categories into tags, one per recipe that had one.
insert into tags (user_id, name)
select distinct c.user_id, c.name from categories c
on conflict (user_id, name) do nothing;

insert into recipe_tags (recipe_id, tag_id)
select r.id, t.id
from recipes r
join categories c on c.id = r.category_id
join tags t on t.user_id = c.user_id and t.name = c.name
where r.category_id is not null;

alter table recipes drop column category_id;
drop table categories;
