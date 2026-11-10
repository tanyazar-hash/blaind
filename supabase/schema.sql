-- Run once in the SQL editor of a new Supabase project.
-- Public visitors have no table access. All requests go through server functions.
create table if not exists public.arena_documents (
  id text primary key check (id = 'main'),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.arena_sessions (
  token_hash text primary key,
  username text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists arena_sessions_expiry on public.arena_sessions(expires_at);
create table if not exists public.arena_login_attempts (
  key text primary key,
  attempts integer not null default 1,
  window_started timestamptz not null default now()
);
alter table public.arena_documents enable row level security;
alter table public.arena_sessions enable row level security;
alter table public.arena_login_attempts enable row level security;
revoke all on public.arena_documents, public.arena_sessions, public.arena_login_attempts from anon, authenticated;
grant all on public.arena_documents, public.arena_sessions, public.arena_login_attempts to service_role;

create or replace function public.arena_document_timestamp()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists arena_document_timestamp on public.arena_documents;
create trigger arena_document_timestamp before update on public.arena_documents
for each row execute function public.arena_document_timestamp();

-- Atomic, persistent rate limiting across serverless instances: 6 attempts / 15 min / IP.
create or replace function public.arena_consume_login(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result public.arena_login_attempts;
begin
  delete from public.arena_login_attempts where window_started < now() - interval '2 days';
  insert into public.arena_login_attempts(key,attempts,window_started) values(p_key,1,now())
  on conflict(key) do update set
    attempts = case when arena_login_attempts.window_started < now()-interval '15 minutes'
      then 1 else arena_login_attempts.attempts+1 end,
    window_started = case when arena_login_attempts.window_started < now()-interval '15 minutes'
      then now() else arena_login_attempts.window_started end
  returning * into result;
  return jsonb_build_object('allowed',result.attempts <= 6,
    'retryAfter',greatest(1,ceil(extract(epoch from result.window_started+interval '15 minutes'-now()))));
end;
$$;
revoke all on function public.arena_consume_login(text) from public, anon, authenticated;
grant execute on function public.arena_consume_login(text) to service_role;
revoke all on function public.arena_document_timestamp() from public, anon, authenticated;

-- Images are public; uploads/removal require the server-side service role.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('arena-images','arena-images',true,3145728,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=3145728,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];
