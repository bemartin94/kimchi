-- Manually-entered recipes have no source URL.
alter table recipes alter column source_url drop not null;
