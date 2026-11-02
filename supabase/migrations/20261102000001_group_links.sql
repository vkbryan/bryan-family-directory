-- =============================================================================
-- Group links, for sharing in the family WhatsApp chat.
--
-- A group link is a join invitation that up to max_uses people can use (50
-- by default) before it expires (14 days, like every invitation). Each new
-- person joins right away. Only admins make them, and an admin can cancel one
-- at any time. Single-person invitations work exactly as before.
--
-- Changes:
-- 1. invitations.max_uses and use_count.
-- 2. create_group_link: admins only.
-- 3. The sign-up gate lets more than one person sign up with a group link,
--    until it is full.
-- 4. accept_invitation counts each new member instead of closing the link.
--    A member who opens it again is let through without being counted.
-- 5. invitation_preview and invitation_photo treat a full link as used up.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. How many people a link is for
-- -----------------------------------------------------------------------------

alter table public.invitations
  add column max_uses  integer check (max_uses between 2 and 500),
  add column use_count integer not null default 0 check (use_count >= 0),
  add constraint group_links_are_join_links check (max_uses is null or kind = 'join');


-- -----------------------------------------------------------------------------
-- 2. Making a group link
-- -----------------------------------------------------------------------------

create function public.create_group_link(p_label text default null, p_max_uses integer default 50)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.app_settings;
  secret text;
begin
  perform public.require_active_member();
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  select * into settings from public.app_settings;

  -- Two random UUIDs give about 244 bits of randomness.
  secret := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.invitations (kind, token_hash, recipient_label, created_by, expires_at, max_uses)
  values ('join', sha256(convert_to(secret, 'UTF8')), nullif(btrim(p_label), ''), auth.uid(),
          now() + make_interval(days => settings.invitation_days), p_max_uses);

  perform public.write_audit('invitation.created', null, null,
    jsonb_build_object('kind', 'group', 'recipient_label', p_label, 'max_uses', p_max_uses));
  return secret;
end;
$$;

revoke execute on function public.create_group_link(text, integer) from public, anon;
grant execute on function public.create_group_link(text, integer) to authenticated;


-- -----------------------------------------------------------------------------
-- 3. Sign-up gate
-- -----------------------------------------------------------------------------

create or replace function private.before_user_created(event jsonb)
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
  if event ? 'email_data' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 500,
      'message', 'Setup problem: private.before_user_created is attached to the Send Email hook. '
                 'It belongs only on "Before User Created". See docs/supabase-setup.md.'
    ));
  end if;

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

  if inv.max_uses is not null then
    -- A group link: many people, until it is full.
    if inv.use_count >= inv.max_uses then
      return refusal;
    end if;
  elsif exists (
    -- Someone has already finished signing in with this one-person link.
    select 1 from auth.users u
    where u.raw_user_meta_data ->> 'invitation' = secret
      and u.email_confirmed_at is not null
  ) then
    return refusal;
  end if;

  return '{}'::jsonb;
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. Accepting
-- -----------------------------------------------------------------------------

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

  if inv.max_uses is not null then
    -- A member who opens the group link again is let through, uncounted.
    if caller_status = 'active' then
      return jsonb_build_object('kind', inv.kind, 'profile_id', null);
    end if;
    if inv.use_count >= inv.max_uses then
      raise exception 'invitation_full';
    end if;
    update public.invitations set use_count = use_count + 1 where id = inv.id;
  else
    if inv.kind = 'claim' then
      perform public.link_profile_to_account(inv.profile_id, auth.uid(), 'invitation');
    elsif inv.kind = 'co_guardian' then
      if (select profile_type from public.profiles where id = inv.profile_id) <> 'child' then
        raise exception 'guardians_only_for_children';
      end if;
      perform public.grant_guardian(inv.profile_id, auth.uid(), 'invitation');
    end if;

    update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  end if;

  if caller_status = 'pending' then
    update public.accounts set status = 'active' where id = auth.uid();
  end if;

  -- The secret is no longer needed on the sign-in record.
  update auth.users set raw_user_meta_data = raw_user_meta_data - 'invitation'
  where id = auth.uid() and raw_user_meta_data ? 'invitation';

  perform public.write_audit('invitation.accepted', inv.profile_id, auth.uid(),
    jsonb_build_object('kind', case when inv.max_uses is not null then 'group' else inv.kind::text end, 'invitation_id', inv.id));

  return jsonb_build_object('kind', inv.kind, 'profile_id', inv.profile_id);
end;
$$;


-- -----------------------------------------------------------------------------
-- 5. A full link reads as used up
-- -----------------------------------------------------------------------------

create or replace function public.invitation_preview(p_secret text)
returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  inv public.invitations;
  inviter text;
  profile_name text;
  status text;
  photo_caption text;
  has_photo boolean := false;
  member_count integer;
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

  status := case
    when inv.revoked_at is not null then 'revoked'
    when inv.accepted_at is not null then 'used'
    when inv.max_uses is not null and inv.use_count >= inv.max_uses then 'full'
    when inv.expires_at < now() then 'expired'
    else 'valid'
  end;

  if status = 'valid' then
    select true, s.caption into has_photo, photo_caption from private.site_photos s where s.name = 'invitation';
    -- Only a number: the same people a member sees in the directory.
    select count(*) into member_count from public.profiles where archived_at is null;
  end if;

  return jsonb_build_object(
    'status', status,
    'kind', inv.kind,
    'is_group', inv.max_uses is not null,
    'recipient_label', inv.recipient_label,
    'inviter_name', inviter,
    'profile_name', profile_name,
    'has_photo', coalesce(has_photo, false),
    'photo_caption', photo_caption,
    'member_count', member_count
  );
end;
$$;

create or replace function public.invitation_photo(p_secret text)
returns table (image_base64 text, content_type text, caption text)
language sql stable
security definer
set search_path = ''
as $$
  select encode(s.image, 'base64'), s.content_type, s.caption
  from private.site_photos s
  where s.name = 'invitation'
    and exists (
      select 1 from public.invitations i
      where i.token_hash = sha256(convert_to(coalesce(p_secret, ''), 'UTF8'))
        and i.revoked_at is null
        and i.accepted_at is null
        and (i.max_uses is null or i.use_count < i.max_uses)
        and i.expires_at > now()
    );
$$;
