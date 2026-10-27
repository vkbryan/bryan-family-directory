-- The invitation page says how many relatives are already in the directory
-- ("10 relatives are already in the directory"), to show it's lived in.
-- Only for a valid invitation, and only the number: no names or faces.

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
    'recipient_label', inv.recipient_label,
    'inviter_name', inviter,
    'profile_name', profile_name,
    'has_photo', coalesce(has_photo, false),
    'photo_caption', photo_caption,
    'member_count', member_count
  );
end;
$$;
