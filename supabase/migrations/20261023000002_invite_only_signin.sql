-- =============================================================================
-- Invite-only sign-in
--
-- 1. Sign-up gate: Supabase calls private.before_user_created before creating
--    any new sign-in user. It refuses unless the sign-up carries a valid,
--    unused invitation. Strangers cannot create accounts.
-- 2. Pending accounts: a new account starts as "pending" and can see nothing
--    until it accepts an invitation. Accepting makes it "active". Each
--    invitation can still be accepted only once.
-- 3. invitation_preview: lets the invitation page show "Verena invited you"
--    before the visitor signs in. It reveals nothing without the link's secret.
-- 4. Faster permission checks (Supabase performance advisor): policies read
--    the signed-in user once per query instead of once per row.
-- =============================================================================

alter type public.account_status add value 'pending' before 'active';


-- -----------------------------------------------------------------------------
-- 1. Sign-up gate
-- -----------------------------------------------------------------------------

-- Supabase's sign-in service runs as supabase_auth_admin.
grant usage on schema private to supabase_auth_admin;

create function private.before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret text := event -> 'user' -> 'user_metadata' ->> 'invitation';
  inv public.invitations;
  refusal jsonb := jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'This invitation link is not valid anymore. Ask the relative who invited you for a new one.'
  ));
begin
  if coalesce(secret, '') = '' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'The family directory is invitation-only. Open the invitation link a relative sent you.'
    ));
  end if;

  select * into inv from public.invitations
  where token_hash = sha256(convert_to(secret, 'UTF8'));

  if inv.id is null or inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at < now() then
    return refusal;
  end if;

  -- Someone has already finished signing in with this link.
  if exists (
    select 1 from auth.users u
    where u.raw_user_meta_data ->> 'invitation' = secret
      and u.email_confirmed_at is not null
  ) then
    return refusal;
  end if;

  return '{}'::jsonb;
end;
$$;

revoke execute on function private.before_user_created(jsonb) from public, anon, authenticated;
grant execute on function private.before_user_created(jsonb) to supabase_auth_admin;


-- -----------------------------------------------------------------------------
-- 2. Pending accounts
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.accounts (id, status) values (new.id, 'pending');
  return new;
end;
$$;

-- Accepting an invitation is the one thing a pending account can do.
create or replace function public.accept_invitation(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invitations;
  caller_status public.account_status;
begin
  select status into caller_status from public.accounts where id = auth.uid();
  if caller_status is null or caller_status = 'deactivated' then
    raise exception 'not_signed_in';
  end if;

  select * into inv from public.invitations
  where token_hash = sha256(convert_to(coalesce(p_secret, ''), 'UTF8'))
  for update;

  if inv.id is null then
    raise exception 'invitation_invalid';
  elsif inv.revoked_at is not null then
    raise exception 'invitation_revoked';
  elsif inv.accepted_at is not null then
    raise exception 'invitation_already_used';
  elsif inv.expires_at < now() then
    raise exception 'invitation_expired';
  end if;

  if inv.kind = 'claim' then
    perform public.link_profile_to_account(inv.profile_id, auth.uid(), 'invitation');
  elsif inv.kind = 'co_guardian' then
    if (select profile_type from public.profiles where id = inv.profile_id) <> 'child' then
      raise exception 'guardians_only_for_children';
    end if;
    perform public.grant_guardian(inv.profile_id, auth.uid(), 'invitation');
  end if;

  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;

  if caller_status = 'pending' then
    update public.accounts set status = 'active' where id = auth.uid();
  end if;

  -- The secret is no longer needed on the sign-in record.
  update auth.users set raw_user_meta_data = raw_user_meta_data - 'invitation'
  where id = auth.uid() and raw_user_meta_data ? 'invitation';

  perform public.write_audit('invitation.accepted', inv.profile_id, auth.uid(), jsonb_build_object('kind', inv.kind));

  return jsonb_build_object('kind', inv.kind, 'profile_id', inv.profile_id);
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. Invitation preview, for the page a relative sees before signing in.
-- -----------------------------------------------------------------------------

create function public.invitation_preview(p_secret text)
returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  inv public.invitations;
  inviter text;
  profile_name text;
begin
  select * into inv from public.invitations
  where token_hash = sha256(convert_to(coalesce(p_secret, ''), 'UTF8'));

  if inv.id is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  select coalesce(nullif(p.aka, ''), split_part(p.full_name, ' ', 1)) into inviter
  from public.profiles p where p.account_id = inv.created_by;

  if inv.kind = 'claim' then
    select full_name into profile_name from public.profiles where id = inv.profile_id;
  end if;

  return jsonb_build_object(
    'status', case
      when inv.revoked_at is not null then 'revoked'
      when inv.accepted_at is not null then 'used'
      when inv.expires_at < now() then 'expired'
      else 'valid'
    end,
    'kind', inv.kind,
    'recipient_label', inv.recipient_label,
    'inviter_name', inviter,
    'profile_name', profile_name
  );
end;
$$;

revoke execute on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 4. Read the signed-in user once per query in these policies.
-- -----------------------------------------------------------------------------

drop policy accounts_read on public.accounts;
create policy accounts_read on public.accounts for select to authenticated
  using (id = (select auth.uid()) or private.is_admin());

drop policy profile_managers_read on public.profile_managers;
create policy profile_managers_read on public.profile_managers for select to authenticated
  using (account_id = (select auth.uid()) or private.can_edit_profile(profile_id));

drop policy invitations_read on public.invitations;
create policy invitations_read on public.invitations for select to authenticated
  using (created_by = (select auth.uid()) or private.is_admin());

drop policy profile_requests_read on public.profile_requests;
create policy profile_requests_read on public.profile_requests for select to authenticated
  using (
    requester_id = (select auth.uid())
    or private.is_admin()
    or (kind = 'co_guardian' and private.is_guardian_of(profile_id))
  );
