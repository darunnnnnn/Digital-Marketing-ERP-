-- A reference link on each video: an example clip to work from, pasted when the
-- content is planned and read by whoever writes and shoots it.
--
-- Adding a column needs no policy changes — row level security decides which
-- rows someone may touch, not which columns, so the existing policies cover it.
--
-- Safe to run more than once.

alter table "ContentItem" add column if not exists "referenceUrl" text;
