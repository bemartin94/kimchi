-- "Anyone with the link" sharing: a random share_token on a recipe, readable
-- via a SECURITY DEFINER function (which bypasses RLS as the table owner)
-- rather than a blanket anon SELECT policy, so sharing one recipe doesn't
-- expose a way to enumerate everyone else's shared recipes.

alter table recipes add column share_token uuid unique;

create or replace function get_shared_recipe(token uuid)
returns table (
  id uuid,
  title text,
  thumbnail_url text,
  source_url text,
  ingredients jsonb,
  steps jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, title, thumbnail_url, source_url, ingredients, steps, created_at
  from recipes
  where share_token = token
$$;

grant execute on function get_shared_recipe(uuid) to anon, authenticated;
