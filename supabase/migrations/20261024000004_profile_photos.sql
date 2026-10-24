-- =============================================================================
-- Private storage for profile photos.
--
-- Photos live in the "profile-photos" bucket at <profile id>/<file name>.
-- The bucket is private: there are no public links. The website asks for a
-- short-lived link per photo, and these rules decide who may get one:
--   see:    active members, if the profile's photo is shared with members;
--           always the person, their guardians and admins
--   change: the person, their guardians and admins (same rule as editing)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- "3f2a…/photo.jpg" -> the profile id, or null for anything else.
create function private.photo_profile_id(object_name text)
returns uuid
language plpgsql stable
set search_path = ''
as $$
begin
  return (storage.foldername(object_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

create function private.can_view_photo(object_name text)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select private.is_active_member() and exists (
    select 1 from public.profiles p
    where p.id = private.photo_profile_id(object_name)
      and p.archived_at is null
      and (p.photo_visibility = 'members' or private.can_edit_profile(p.id))
  );
$$;

revoke execute on function private.photo_profile_id(text), private.can_view_photo(text) from public, anon;
grant execute on function private.photo_profile_id(text), private.can_view_photo(text) to authenticated;

create policy profile_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'profile-photos' and private.can_view_photo(name));

create policy profile_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and private.can_edit_profile(private.photo_profile_id(name)));

create policy profile_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'profile-photos' and private.can_edit_profile(private.photo_profile_id(name)))
  with check (bucket_id = 'profile-photos' and private.can_edit_profile(private.photo_profile_id(name)));

create policy profile_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos' and private.can_edit_profile(private.photo_profile_id(name)));
