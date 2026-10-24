-- =============================================================================
-- Admin overview of sign-in accounts.
--
-- Sign-in emails live in Supabase's auth.users, which app users cannot read.
-- Admins need them to help relatives who are stuck ("which email did I use?"),
-- so this returns them, with each account's status and profile, to admins
-- only. Everyone else gets nothing.
--
-- Also: the claim requests an admin must decide, with the requester's
-- sign-in email (claimers have no profile yet, so no name to show).
-- =============================================================================

create function public.admin_accounts()
returns table (
  account_id      uuid,
  email           text,
  role            public.account_role,
  status          public.account_status,
  created_at      timestamptz,
  last_sign_in_at timestamptz,
  profile_id      uuid,
  full_name       text
)
language sql stable
security definer
set search_path = ''
as $$
  select a.id, u.email, a.role, a.status, a.created_at, u.last_sign_in_at, p.id, p.full_name
  from public.accounts a
  join auth.users u on u.id = a.id
  left join public.profiles p on p.account_id = a.id
  where private.is_admin()
  order by a.created_at;
$$;

create function public.admin_claim_requests()
returns table (
  id              uuid,
  profile_id      uuid,
  profile_name    text,
  requester_email text,
  message         text,
  created_at      timestamptz
)
language sql stable
security definer
set search_path = ''
as $$
  select r.id, r.profile_id, p.full_name, u.email, r.message, r.created_at
  from public.profile_requests r
  join public.profiles p on p.id = r.profile_id
  join auth.users u on u.id = r.requester_id
  where r.kind = 'claim'
    and r.status = 'pending'
    and private.is_admin()
  order by r.created_at;
$$;

revoke execute on function public.admin_accounts(), public.admin_claim_requests() from public, anon;
grant execute on function public.admin_accounts(), public.admin_claim_requests() to authenticated;
