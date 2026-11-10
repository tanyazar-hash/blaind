-- First create/confirm this account in Supabase → Authentication → Users → Add user.
-- Replace the email below. This query neither creates an Auth account nor sends email.
do $$
declare account_id uuid;
begin
  select id into account_id from auth.users
  where lower(email)=lower('ADMIN_EMAIL_HERE');
  if account_id is null then
    raise exception 'Create the administrator in Authentication → Users first, then set their email in this SQL';
  end if;
  insert into public.arena_admins(user_id) values(account_id) on conflict(user_id) do nothing;
end;
$$;
