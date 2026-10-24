-- =============================================================================
-- Fix for 20261024000001: the hook-name check also refused genuine
-- "Before User Created" calls, because Supabase's live payload names the hook
-- differently from its documentation. That blocked every new sign-up (safely,
-- but invited relatives too).
--
-- Instead, recognise a Send Email call by what it always carries and a
-- sign-up never does: "email_data" (required in Supabase's Send Email schema).
-- =============================================================================

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
