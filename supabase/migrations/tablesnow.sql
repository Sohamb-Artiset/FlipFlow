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
    "policyname": "flipbook_views_insert_owner",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(EXISTS ( SELECT 1\n   FROM flipbooks f\n  WHERE ((f.id = flipbook_views.flipbook_id) AND (f.user_id = auth.uid()))))"
  },
  {
    "schemaname": "public",
    "tablename": "flipbook_views",
    "policyname": "flipbook_views_insert_public",
    "permissive": "PERMISSIVE",
    "roles": "{anon,authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(EXISTS ( SELECT 1\n   FROM flipbooks f\n  WHERE ((f.id = flipbook_views.flipbook_id) AND (COALESCE(f.is_public, false) = true))))"
  },
  {
    "schemaname": "public",
    "tablename": "flipbook_views",
    "policyname": "flipbook_views_select_owner",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(EXISTS ( SELECT 1\n   FROM flipbooks f\n  WHERE ((f.id = flipbook_views.flipbook_id) AND (f.user_id = auth.uid()))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "flipbooks",
    "policyname": "flipbooks_delete_owner",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "(user_id = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "flipbooks",
    "policyname": "flipbooks_insert_owner",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(user_id = auth.uid())"
  },
  {
    "schemaname": "public",
    "tablename": "flipbooks",
    "policyname": "flipbooks_select_owner",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(user_id = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "flipbooks",
    "policyname": "flipbooks_select_public",
    "permissive": "PERMISSIVE",
    "roles": "{anon,authenticated}",
    "cmd": "SELECT",
    "qual": "(COALESCE(is_public, false) = true)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "flipbooks",
    "policyname": "flipbooks_update_owner",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "(user_id = auth.uid())",
    "with_check": "(user_id = auth.uid())"
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "profiles_insert_self",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(id = auth.uid())"
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "profiles_select_self",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(id = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "profiles_update_self",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "(id = auth.uid())",
    "with_check": "(id = auth.uid())"
  },
  {
    "schemaname": "public",
    "tablename": "user_roles",
    "policyname": "user_roles_all_admin",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "has_role('admin'::app_role, auth.uid())",
    "with_check": "has_role('admin'::app_role, auth.uid())"
  },
  {
    "schemaname": "public",
    "tablename": "user_roles",
    "policyname": "user_roles_select_self",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(user_id = auth.uid())",
    "with_check": null
  }
]