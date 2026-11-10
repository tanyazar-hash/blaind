-- Run in the Supabase SQL Editor. Safe to re-run; existing ARENA content is kept.
begin;
create table if not exists public.arena_documents (
  id text primary key check (id = 'main'),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.arena_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.arena_documents enable row level security;
alter table public.arena_admins enable row level security;
revoke all on public.arena_documents,public.arena_admins from public,anon,authenticated;
grant select on public.arena_documents to anon,authenticated;
grant update(document,version) on public.arena_documents to authenticated;
grant select on public.arena_admins to authenticated;
grant all on public.arena_documents,public.arena_admins to service_role;

-- No browser or authenticated user can enroll themselves as an administrator.
-- Membership is managed only by the owner through SQL Editor / trusted tooling.
create or replace function public.is_arena_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.arena_admins where user_id=(select auth.uid()));
$$;
revoke all on function public.is_arena_admin() from public;
grant execute on function public.is_arena_admin() to anon,authenticated,service_role;
drop policy if exists arena_admin_self on public.arena_admins;
create policy arena_admin_self on public.arena_admins for select to authenticated
using (user_id=(select auth.uid()));
drop policy if exists arena_public_read on public.arena_documents;
create policy arena_public_read on public.arena_documents for select to anon,authenticated
using (id='main');
drop policy if exists arena_admin_update on public.arena_documents;
create policy arena_admin_update on public.arena_documents for update to authenticated
using (id='main' and (select public.is_arena_admin()))
with check (id='main' and (select public.is_arena_admin()));

create or replace function public.arena_document_timestamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.version <> old.version+1 then
    raise exception 'ARENA version must increment by one' using errcode='23514';
  end if;
  new.updated_at=now();
  return new;
end;
$$;
revoke all on function public.arena_document_timestamp() from public,anon,authenticated;
drop trigger if exists arena_document_timestamp on public.arena_documents;
create trigger arena_document_timestamp before update on public.arena_documents
for each row execute function public.arena_document_timestamp();

-- Close legacy custom-auth tables if upgrading; do not delete data or old tables.
do $$
declare t text;
begin
  foreach t in array array['arena_sessions','arena_login_attempts'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security',t);
      execute format('revoke all on public.%I from public,anon,authenticated',t);
    end if;
  end loop;
end;
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('arena-images','arena-images',true,3145728,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=3145728,
allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists arena_images_public_read on storage.objects;
create policy arena_images_public_read on storage.objects for select to anon,authenticated
using (bucket_id='arena-images');
drop policy if exists arena_images_admin_insert on storage.objects;
create policy arena_images_admin_insert on storage.objects for insert to authenticated
with check (bucket_id='arena-images' and (select public.is_arena_admin()));
drop policy if exists arena_images_admin_update on storage.objects;
create policy arena_images_admin_update on storage.objects for update to authenticated
using (bucket_id='arena-images' and (select public.is_arena_admin()))
with check (bucket_id='arena-images' and (select public.is_arena_admin()));
drop policy if exists arena_images_admin_delete on storage.objects;
create policy arena_images_admin_delete on storage.objects for delete to authenticated
using (bucket_id='arena-images' and (select public.is_arena_admin()));
commit;
