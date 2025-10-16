create table public.flipbook_views (
  id uuid not null default gen_random_uuid (),
  flipbook_id uuid not null,
  viewed_at timestamp with time zone null default now(),
  ip_address text null,
  user_agent text null,
  constraint flipbook_views_pkey primary key (id),
  constraint flipbook_views_flipbook_id_fkey foreign KEY (flipbook_id) references flipbooks (id) on delete CASCADE
) TABLESPACE pg_default;


create table public.flipbooks (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  title text not null,
  description text null,
  pdf_url text not null,
  cover_image_url text null,
  background_color text null default '#ffffff'::text,
  logo_url text null,
  is_public boolean null default true,
  view_count integer null default 0,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  show_covers boolean null default true,
  constraint flipbooks_pkey primary key (id),
  constraint flipbooks_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger update_flipbooks_updated_at BEFORE
update on flipbooks for EACH row
execute FUNCTION update_updated_at_column ();



create table public.profiles (
  id uuid not null,
  email text not null,
  full_name text null,
  avatar_url text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  plan text null default 'free'::text,
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE,
  constraint profiles_plan_check check (
    (plan = any (array['free'::text, 'premium'::text]))
  )
) TABLESPACE pg_default;

create trigger update_profiles_updated_at BEFORE
update on profiles for EACH row
execute FUNCTION update_updated_at_column ();

create table public.user_roles (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamp with time zone null default now(),
  constraint user_roles_pkey primary key (id),
  constraint user_roles_user_id_role_key unique (user_id, role),
  constraint user_roles_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

[
  {
    "schemaname": "public",
    "tablename": "flipbook_views",
    "policyname": "Anyone can insert views",
    "permissive": "PERMISSIVE",
    "roles": "{anon,authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "true"
  },
  {
    "schemaname": "public",
    "tablename": "flipbook_views",
    "policyname": "Owners can view analytics",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(EXISTS ( SELECT 1\n   FROM flipbooks\n  WHERE ((flipbooks.id = flipbook_views.flipbook_id) AND (flipbooks.user_id = auth.uid()))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "flipbooks",
    "policyname": "Allow authenticated users to create flipbooks",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(auth.uid() = user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "flipbooks",
    "policyname": "Allow authenticated users to delete their own flipbooks",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "(auth.uid() = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "flipbooks",
    "policyname": "Allow authenticated users to update their own flipbooks",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "(auth.uid() = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "flipbooks",
    "policyname": "Allow authenticated users to view their own flipbooks",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(auth.uid() = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "flipbooks",
    "policyname": "Anyone can view public flipbooks",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(is_public = true)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "Allow users to create and update their own profile",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(auth.uid() = id)",
    "with_check": "(auth.uid() = id)"
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "Allow users to view their own profile",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(auth.uid() = id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "Users can insert own profile",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(auth.uid() = id)"
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "Users can update own profile",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "(auth.uid() = id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "Users can view own profile",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(auth.uid() = id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "user_roles",
    "policyname": "Admins can manage all roles",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "has_role(auth.uid(), 'admin'::app_role)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "user_roles",
    "policyname": "Users can view own roles",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(auth.uid() = user_id)",
    "with_check": null
  },
  {
    "schemaname": "storage",
    "tablename": "objects",
    "policyname": "Anyone can view assets",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(bucket_id = 'flipbook-assets'::text)",
    "with_check": null
  },
  {
    "schemaname": "storage",
    "tablename": "objects",
    "policyname": "Anyone can view public assets",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(bucket_id = 'flipbook-assets'::text)",
    "with_check": null
  },
  {
    "schemaname": "storage",
    "tablename": "objects",
    "policyname": "Public Read Access for PDFs 1ck5108_0",
    "permissive": "PERMISSIVE",
    "roles": "{anon,authenticated}",
    "cmd": "SELECT",
    "qual": "(bucket_id = 'flipbook-pdfs'::text)",
    "with_check": null
  },
  {
    "schemaname": "storage",
    "tablename": "objects",
    "policyname": "Users can delete their own PDFs",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "((bucket_id = 'flipbook-pdfs'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]))",
    "with_check": null
  },
  {
    "schemaname": "storage",
    "tablename": "objects",
    "policyname": "Users can delete their own assets",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "((bucket_id = 'flipbook-assets'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]))",
    "with_check": null
  },
  {
    "schemaname": "storage",
    "tablename": "objects",
    "policyname": "Users can update their own PDFs",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "((bucket_id = 'flipbook-pdfs'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]))",
    "with_check": null
  },
  {
    "schemaname": "storage",
    "tablename": "objects",
    "policyname": "Users can update their own assets",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "((bucket_id = 'flipbook-assets'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]))",
    "with_check": null
  },
  {
    "schemaname": "storage",
    "tablename": "objects",
    "policyname": "Users can upload their own PDFs",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "((bucket_id = 'flipbook-pdfs'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]))"
  },
  {
    "schemaname": "storage",
    "tablename": "objects",
    "policyname": "Users can upload their own assets",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "((bucket_id = 'flipbook-assets'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]))"
  }
]
-- ---------------------------------------------------------------------------
-- Executable RLS policies and RPCs (converted from the policy intent above)
-- ---------------------------------------------------------------------------

-- Ensure gen_random_uuid is available
create extension if not exists pgcrypto;

-- Explicitly enable RLS (idempotent if already on)
alter table if exists public.flipbooks enable row level security;
alter table if exists public.flipbook_views enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.user_roles enable row level security;

-- flipbooks: owner/public policies
drop policy if exists flipbooks_select_owner on public.flipbooks;
create policy flipbooks_select_owner
  on public.flipbooks for select to authenticated
  using (user_id = auth.uid());

drop policy if exists flipbooks_select_public on public.flipbooks;
create policy flipbooks_select_public
  on public.flipbooks for select to anon, authenticated
  using (coalesce(is_public, false) = true);

drop policy if exists flipbooks_insert_owner on public.flipbooks;
create policy flipbooks_insert_owner
  on public.flipbooks for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists flipbooks_update_owner on public.flipbooks;
create policy flipbooks_update_owner
  on public.flipbooks for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists flipbooks_delete_owner on public.flipbooks;
create policy flipbooks_delete_owner
  on public.flipbooks for delete to authenticated
  using (user_id = auth.uid());

-- flipbook_views: restrict anon inserts to public; owners can insert; owners can select
drop policy if exists "Anyone can insert views" on public.flipbook_views;
drop policy if exists flipbook_views_insert_public on public.flipbook_views;
create policy flipbook_views_insert_public
  on public.flipbook_views for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.flipbooks f
      where f.id = flipbook_id and coalesce(f.is_public, false) = true
    )
  );

drop policy if exists flipbook_views_insert_owner on public.flipbook_views;
create policy flipbook_views_insert_owner
  on public.flipbook_views for insert to authenticated
  with check (
    exists (
      select 1 from public.flipbooks f
      where f.id = flipbook_id and f.user_id = auth.uid()
    )
  );

drop policy if exists "Owners can view analytics" on public.flipbook_views;
drop policy if exists flipbook_views_select_owner on public.flipbook_views;
create policy flipbook_views_select_owner
  on public.flipbook_views for select to authenticated
  using (
    exists (
      select 1 from public.flipbooks f
      where f.id = flipbook_id and f.user_id = auth.uid()
    )
  );

-- profiles: self-only
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- user_roles: self select + admin manage
create or replace function public.has_role(_role public.app_role, _user_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = _user_id and r.role = _role
  );
$$;

drop policy if exists user_roles_select_self on public.user_roles;
create policy user_roles_select_self
  on public.user_roles for select to authenticated
  using (user_id = auth.uid());

drop policy if exists user_roles_all_admin on public.user_roles;
create policy user_roles_all_admin
  on public.user_roles for all to authenticated
  using (public.has_role('admin', auth.uid()))
  with check (public.has_role('admin', auth.uid()));

-- Atomic RPC to record view and increment count
create or replace function public.record_flipbook_view(
  p_flipbook_id uuid,
  p_user_agent text default null,
  p_ip text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.flipbooks f
    where f.id = p_flipbook_id
      and (coalesce(f.is_public, false) = true or f.user_id = auth.uid())
  ) then
    raise exception 'not allowed';
  end if;

  update public.flipbooks
  set view_count = coalesce(view_count, 0) + 1
  where id = p_flipbook_id;

  insert into public.flipbook_views (flipbook_id, user_agent, ip_address)
  values (p_flipbook_id, p_user_agent, p_ip);
end;$$;
