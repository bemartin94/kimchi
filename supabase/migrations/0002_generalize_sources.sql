-- Recipes can now come from any recipe website, not just YouTube.
alter table recipes rename column youtube_url to source_url;
alter table recipes alter column video_id drop not null;
alter table recipes alter column thumbnail_url drop not null;
