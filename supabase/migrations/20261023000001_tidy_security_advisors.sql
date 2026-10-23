-- =============================================================================
-- Clears the findings from Supabase's security checker (database advisors):
--
-- 1. "Security Definer View" (error) on directory_profiles.
--    The view is replaced by a function with the same columns and the same
--    rules. The app calls it as rpc('directory_profiles') and can still filter
--    and sort the results.
--
-- 2. "Signed-in users can execute SECURITY DEFINER function" (warnings) for the
--    internal permission helpers. They move to a "private" schema, which the
--    website's API does not expose. Row-level security policies follow them
--    automatically. The old public names stay behind as stand-ins, used only
--    by the database's own functions, so signed-in users can no longer call them.
--
-- No permission rule changes.
-- =============================================================================

create schema private;

-- Policies run as the signed-in user, so that role needs to reach the helpers.
-- This schema is not part of the API, so it still cannot be called from the website.
grant usage on schema private to authenticated;


-- -----------------------------------------------------------------------------
-- 1. Move the helpers. Policies refer to functions directly, not by name, so
--    every existing policy now uses the private versions.
-- -----------------------------------------------------------------------------

alter function public.is_active_member()     set schema private;
alter function public.is_admin()             set schema private;
alter function public.is_guardian_of(uuid)   set schema private;
alter function public.can_edit_profile(uuid) set schema private;
alter function public.my_profile_id()        set schema private;

-- Point the helpers that call each other at their new home.
create or replace function private.is_guardian_of(p_profile_id uuid)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select private.is_active_member() and exists (
    select 1 from public.profile_managers m
    where m.profile_id = p_profile_id
      and m.account_id = auth.uid()
      and m.revoked_at is null
  );
$$;

create or replace function private.can_edit_profile(p_profile_id uuid)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select private.is_active_member() and (
    private.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = p_profile_id and p.account_id = auth.uid() and p.archived_at is null
    )
    or private.is_guardian_of(p_profile_id)
  );
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;


-- -----------------------------------------------------------------------------
-- 2. Stand-ins with the old names, used inside the database's own functions.
--    Not callable by signed-in users.
-- -----------------------------------------------------------------------------

create function public.is_active_member()
returns boolean language sql stable set search_path = ''
as $$ select private.is_active_member(); $$;

create function public.is_admin()
returns boolean language sql stable set search_path = ''
as $$ select private.is_admin(); $$;

create function public.is_guardian_of(p_profile_id uuid)
returns boolean language sql stable set search_path = ''
as $$ select private.is_guardian_of(p_profile_id); $$;

create function public.can_edit_profile(p_profile_id uuid)
returns boolean language sql stable set search_path = ''
as $$ select private.can_edit_profile(p_profile_id); $$;

create function public.my_profile_id()
returns uuid language sql stable set search_path = ''
as $$ select private.my_profile_id(); $$;

revoke execute on function
  public.is_active_member(),
  public.is_admin(),
  public.is_guardian_of(uuid),
  public.can_edit_profile(uuid),
  public.my_profile_id()
from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 3. Replace the directory view with a function. Same columns, same rules:
--    hidden fields come back empty unless the viewer may edit the profile,
--    and signed-out or deactivated users get nothing.
-- -----------------------------------------------------------------------------

drop view public.directory_profiles;

create function public.directory_profiles()
returns table (
  id            uuid,
  full_name     text,
  aka           text,
  profile_type  public.profile_type,
  is_living     boolean,
  is_claimed    boolean,
  is_me         boolean,
  can_edit      boolean,
  city          text,
  state         text,
  photo_path    text,
  birth_month   smallint,
  birth_day     smallint,
  birth_year    smallint,
  contact_email text,
  phone         text,
  instagram     text,
  linkedin      text,
  website       text,
  updated_at    timestamptz
)
language sql stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.full_name,
    p.aka,
    p.profile_type,
    p.is_living,
    (p.account_id is not null),
    coalesce(p.account_id = auth.uid(), false),
    e.can_edit,
    case when e.can_edit or p.location_visibility   = 'members' then p.city          end,
    case when e.can_edit or p.location_visibility   = 'members' then p.state         end,
    case when e.can_edit or p.photo_visibility      = 'members' then p.photo_path    end,
    case when e.can_edit or p.birthday_visibility   = 'members' then p.birth_month   end,
    case when e.can_edit or p.birthday_visibility   = 'members' then p.birth_day     end,
    case when e.can_edit or p.birth_year_visibility = 'members' then p.birth_year    end,
    case when e.can_edit or p.email_visibility      = 'members' then p.contact_email end,
    case when e.can_edit or p.phone_visibility      = 'members' then p.phone         end,
    case when e.can_edit or p.social_visibility     = 'members' then p.instagram     end,
    case when e.can_edit or p.social_visibility     = 'members' then p.linkedin      end,
    case when e.can_edit or p.social_visibility     = 'members' then p.website       end,
    p.updated_at
  from public.profiles p
  cross join lateral (select private.can_edit_profile(p.id) as can_edit) e
  where p.archived_at is null
    and private.is_active_member();
$$;

revoke execute on function public.directory_profiles() from public, anon;
grant execute on function public.directory_profiles() to authenticated;
