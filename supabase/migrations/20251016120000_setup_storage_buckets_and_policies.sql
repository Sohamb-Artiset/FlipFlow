-- Create storage buckets and enforce RLS policies for FlipFlow
-- Idempotent: safe to run multiple times

-- Ensure extensions used elsewhere
create extension if not exists pgcrypto;

-- Create buckets if missing (set as public for CDN access to PDFs/assets)
-- Use UPSERT into storage.buckets for idempotency
insert into storage.buckets (id, name, public)
values ('flipbook-pdfs', 'flipbook-pdfs', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('flipbook-assets', 'flipbook-assets', true)
on conflict (id) do update set public = excluded.public;

-- Enable RLS on storage.objects (usually enabled by default)
alter table if exists storage.objects enable row level security;

-- Helper: drop policy if exists wrapper
do $$
begin
  -- PDFs
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'pdfs_select_public') then
    drop policy pdfs_select_public on storage.objects;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'pdfs_insert_owner') then
    drop policy pdfs_insert_owner on storage.objects;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'pdfs_update_owner') then
    drop policy pdfs_update_owner on storage.objects;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'pdfs_delete_owner') then
    drop policy pdfs_delete_owner on storage.objects;
  end if;

  -- Assets
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'assets_select_public') then
    drop policy assets_select_public on storage.objects;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'assets_insert_owner') then
    drop policy assets_insert_owner on storage.objects;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'assets_update_owner') then
    drop policy assets_update_owner on storage.objects;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'assets_delete_owner') then
    drop policy assets_delete_owner on storage.objects;
  end if;
end $$;

-- Public read for PDFs and assets (bucket is also public for CDN URLs)
create policy pdfs_select_public
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'flipbook-pdfs');

create policy assets_select_public
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'flipbook-assets');

-- Allow only owners (first folder = auth.uid()) to insert/update/delete
-- Insert
create policy pdfs_insert_owner
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'flipbook-pdfs'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

create policy assets_insert_owner
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'flipbook-assets'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Update
create policy pdfs_update_owner
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'flipbook-pdfs'
    and (auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'flipbook-pdfs'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

create policy assets_update_owner
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'flipbook-assets'
    and (auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'flipbook-assets'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Delete
create policy pdfs_delete_owner
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'flipbook-pdfs'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

create policy assets_delete_owner
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'flipbook-assets'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );


