-- =============================================================================
-- Read-only helpers for the child-profile screens.
--
-- profile_guardians: names of a child's active parents/guardians, shown only
--   to people who may edit that child (its guardians and admins).
-- pending_co_guardian_requests: open "help manage this child" requests, shown
--   only to the child's guardians and admins, who decide them.
--
-- Both return nothing to anyone else, and grant nothing.
-- =============================================================================

create function public.profile_guardians(p_profile_id uuid)
returns table (account_id uuid, full_name text, is_me boolean, granted_at timestamptz)
language sql stable
security definer
set search_path = ''
as $$
  select
    m.account_id,
    coalesce(p.full_name, 'A family member'),
    m.account_id = auth.uid(),
    m.granted_at
  from public.profile_managers m
  left join public.profiles p on p.account_id = m.account_id
  where m.profile_id = p_profile_id
    and m.revoked_at is null
    and private.can_edit_profile(p_profile_id)
  order by m.granted_at;
$$;

create function public.pending_co_guardian_requests(p_profile_id uuid)
returns table (id uuid, requester_name text, message text, created_at timestamptz)
language sql stable
security definer
set search_path = ''
as $$
  select r.id, coalesce(p.full_name, 'A family member'), r.message, r.created_at
  from public.profile_requests r
  left join public.profiles p on p.account_id = r.requester_id
  where r.profile_id = p_profile_id
    and r.kind = 'co_guardian'
    and r.status = 'pending'
    and (private.is_guardian_of(p_profile_id) or private.is_admin())
  order by r.created_at;
$$;

revoke execute on function public.profile_guardians(uuid), public.pending_co_guardian_requests(uuid) from public, anon;
grant execute on function public.profile_guardians(uuid), public.pending_co_guardian_requests(uuid) to authenticated;
