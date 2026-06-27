-- Run in Supabase SQL Editor
alter table pending_wines add column if not exists label_image_url text;
