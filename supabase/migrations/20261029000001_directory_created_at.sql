-- =============================================================================
-- The directory also says when each profile was added, so the home page can
-- show the newest relatives first. Nothing else changes: same rows, same
-- hidden fields. Adding a column means dropping and re-creating the function.
-- =============================================================================

drop function public.directory_profiles();

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
  updated_at    timestamptz,
  created_at    timestamptz
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
    private.can_edit_profile(p.id),
    case when s.sees_all or p.location_visibility   = 'members' then p.city          end,
    case when s.sees_all or p.location_visibility   = 'members' then p.state         end,
    case when s.sees_all or p.photo_visibility      = 'members' then p.photo_path    end,
    case when s.sees_all or p.birthday_visibility   = 'members' then p.birth_month   end,
    case when s.sees_all or p.birthday_visibility   = 'members' then p.birth_day     end,
    case when s.sees_all or p.birth_year_visibility = 'members' then p.birth_year    end,
    case when s.sees_all or p.email_visibility      = 'members' then p.contact_email end,
    case when s.sees_all or p.phone_visibility      = 'members' then p.phone         end,
    case when s.sees_all or p.social_visibility     = 'members' then p.instagram     end,
    case when s.sees_all or p.social_visibility     = 'members' then p.linkedin      end,
    case when s.sees_all or p.social_visibility     = 'members' then p.website       end,
    p.updated_at,
    p.created_at
  from public.profiles p
  cross join lateral (
    select coalesce(p.account_id = auth.uid(), false) or private.is_guardian_of(p.id) as sees_all
  ) s
  where p.archived_at is null
    and private.is_active_member();
$$;

revoke execute on function public.directory_profiles() from public, anon;
grant execute on function public.directory_profiles() to authenticated;
