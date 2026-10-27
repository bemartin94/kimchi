-- Storage bucket for user-uploaded recipe photos (as an alternative to the
-- auto-extracted thumbnail_url). Public read (thumbnails are shown even on
-- the anonymous public share page), write restricted to a user's own
-- "<user_id>/..." path prefix within the bucket.

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

create policy "Recipe images are publicly readable"
on storage.objects for select
using (bucket_id = 'recipe-images');

create policy "Users can upload their own recipe images"
on storage.objects for insert
with check (bucket_id = 'recipe-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update their own recipe images"
on storage.objects for update
using (bucket_id = 'recipe-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own recipe images"
on storage.objects for delete
using (bucket_id = 'recipe-images' and auth.uid()::text = (storage.foldername(name))[1]);
