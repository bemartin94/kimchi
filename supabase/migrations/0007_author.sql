-- Original recipe author/creator, when the source page or video exposes one
-- (schema.org Recipe author, a page's author meta tag, or a YouTube channel
-- name via oEmbed). Nullable since most sources won't have one.

alter table recipes add column author text;

drop function if exists get_shared_recipe(uuid);

create function get_shared_recipe(token uuid)
returns table (
  id uuid,
  title text,
  thumbnail_url text,
  source_url text,
  author text,
  ingredients jsonb,
  steps jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, title, thumbnail_url, source_url, author, ingredients, steps, created_at
  from recipes
  where share_token = token
$$;

grant execute on function get_shared_recipe(uuid) to anon, authenticated;
