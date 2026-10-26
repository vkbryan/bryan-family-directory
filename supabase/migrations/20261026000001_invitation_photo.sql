-- =============================================================================
-- A family photo on the invitation page, so the link feels familiar, not sketchy.
--
-- The photo is stored in the private schema (not reachable through the
-- website's API, not in public storage, not in git). The only way to get it is
-- invitation_photo(secret), which returns it only for a valid, unused,
-- unexpired invitation. Search engines and strangers without a working link
-- never see it.
-- =============================================================================

create table private.site_photos (
  name         text primary key,
  image        bytea not null,
  content_type text not null default 'image/jpeg' check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  caption      text check (char_length(caption) <= 200),
  updated_at   timestamptz not null default now()
);

-- Returns the photo as base64 with its caption, or nothing.
create function public.invitation_photo(p_secret text)
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
        and i.expires_at > now()
    );
$$;

revoke execute on function public.invitation_photo(text) from public;
grant execute on function public.invitation_photo(text) to anon, authenticated;

-- The invitation preview also says whether there's a photo (and its caption),
-- so the page can show it without downloading it twice. Only for valid links.
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
  end if;

  return jsonb_build_object(
    'status', status,
    'kind', inv.kind,
    'recipient_label', inv.recipient_label,
    'inviter_name', inviter,
    'profile_name', profile_name,
    'has_photo', coalesce(has_photo, false),
    'photo_caption', photo_caption
  );
end;
$$;
