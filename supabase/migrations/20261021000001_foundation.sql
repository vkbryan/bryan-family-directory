-- =============================================================================
-- Bryan Family Directory — foundation schema
--
-- Five separate ideas live in separate places:
--   accounts             who can sign in
--   profiles             every person in the family (with or without a login)
--   family_relationships who is related to whom (genealogy only, grants nothing)
--   profile_managers     which accounts may edit which child profiles
--   invitations          single-use links that let people join, claim or co-manage
--
-- Every permission decision goes through one function: can_edit_profile().
-- Members never read the profiles table directly; they read the
-- directory_profiles view, which blanks out anything they may not see.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------

create type public.account_role      as enum ('member', 'admin');
create type public.account_status    as enum ('active', 'deactivated');
create type public.profile_type      as enum ('adult', 'child');
create type public.visibility        as enum ('members', 'private');  -- private = the person, their guardians and admins
create type public.relationship_type as enum ('parent', 'partner');
create type public.manager_role      as enum ('guardian');
create type public.invitation_kind   as enum ('join', 'claim', 'co_guardian');
create type public.request_kind      as enum ('claim', 'co_guardian');
create type public.request_status    as enum ('pending', 'approved', 'denied', 'cancelled');


-- -----------------------------------------------------------------------------
-- Small helpers used by constraints
-- -----------------------------------------------------------------------------

-- True when the birthday parts form a real date. The year may be unknown
-- (2000 is used for the check because it is a leap year, so Feb 29 is allowed).
create function public.is_valid_birthday(y smallint, m smallint, d smallint)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  if d is not null and m is null then
    return false;
  end if;
  if m is null or d is null then
    return true;
  end if;
  perform make_date(coalesce(y, 2000)::int, m::int, d::int);
  return true;
exception when others then
  return false;
end;
$$;

-- "All Things Hip-Hop " -> "all-things-hip-hop"
create function public.slugify(value text)
returns text
language sql immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(btrim(value)), '[^a-z0-9]+', '-', 'g'));
$$;


-- -----------------------------------------------------------------------------
-- Settings (a single row)
-- -----------------------------------------------------------------------------

create table public.app_settings (
  id                 boolean primary key default true check (id),
  members_can_invite boolean  not null default true,
  invitation_days    smallint not null default 14 check (invitation_days between 1 and 90),
  max_guardians      smallint not null default 4  check (max_guardians between 1 and 10)
);

insert into public.app_settings default values;


-- -----------------------------------------------------------------------------
-- Accounts: one row per person who can sign in.
-- The sign-in email lives in Supabase's auth.users and is never copied here.
-- -----------------------------------------------------------------------------

create table public.accounts (
  id             uuid primary key references auth.users (id) on delete cascade,
  role           public.account_role   not null default 'member',
  status         public.account_status not null default 'active',
  created_at     timestamptz not null default now(),
  deactivated_at timestamptz,
  deactivated_by uuid references public.accounts (id) on delete set null
);


-- -----------------------------------------------------------------------------
-- Profiles: every person in the family, whether or not they ever sign in.
-- -----------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key default gen_random_uuid(),

  -- Filled in only when this profile IS the account holder. Unique, so an
  -- account can be "me" on at most one profile.
  account_id   uuid unique references public.accounts (id) on delete set null,

  profile_type public.profile_type not null default 'adult',
  is_living    boolean not null default true,

  full_name    text not null check (char_length(btrim(full_name)) between 1 and 200),
  aka          text check (char_length(aka) <= 200),

  birth_year   smallint check (birth_year between 1800 and 2200),
  birth_month  smallint check (birth_month between 1 and 12),
  birth_day    smallint check (birth_day between 1 and 31),

  city         text check (char_length(city) <= 120),
  state        text check (char_length(state) <= 120),
  photo_path   text check (char_length(photo_path) <= 500),

  contact_email text check (char_length(contact_email) <= 320),
  phone         text check (char_length(phone) <= 40),
  instagram     text check (char_length(instagram) <= 200),
  linkedin      text check (char_length(linkedin) <= 500),
  website       text check (char_length(website) <= 500),

  -- Privacy, one setting per group of fields.
  location_visibility   public.visibility not null default 'members',
  photo_visibility      public.visibility not null default 'members',
  birthday_visibility   public.visibility not null default 'members',  -- month and day
  birth_year_visibility public.visibility not null default 'private',
  email_visibility      public.visibility not null default 'private',
  phone_visibility      public.visibility not null default 'private',
  social_visibility     public.visibility not null default 'members',  -- instagram, linkedin, website

  source      text not null default 'admin' check (source in ('import', 'self', 'guardian', 'admin')),
  import_key  text unique,   -- lets the importer update instead of duplicating
  legacy      jsonb,         -- original imported values, kept as history only

  created_by  uuid references public.accounts (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_by  uuid references public.accounts (id) on delete set null,
  updated_at  timestamptz not null default now(),
  archived_at timestamptz,

  constraint profiles_birthday_valid
    check (public.is_valid_birthday(birth_year, birth_month, birth_day)),
  -- Children never have logins.
  constraint profiles_child_no_account
    check (profile_type <> 'child' or account_id is null),
  -- Contact details cannot be stored for children at all.
  constraint profiles_child_no_contact
    check (profile_type <> 'child' or (contact_email is null and phone is null
           and instagram is null and linkedin is null and website is null)),
  -- A child's birth year is never shown to other members.
  constraint profiles_child_birth_year_private
    check (profile_type <> 'child' or birth_year_visibility = 'private'),
  -- Memorial profiles cannot be claimed.
  constraint profiles_deceased_no_account
    check (is_living or account_id is null)
);

create index profiles_full_name_idx   on public.profiles (lower(full_name));
create index profiles_aka_idx         on public.profiles (lower(aka));
create index profiles_birth_month_idx on public.profiles (birth_month);
create index profiles_location_idx    on public.profiles (lower(state), lower(city));


-- -----------------------------------------------------------------------------
-- Family branches (primary way to browse) and hobbies
-- -----------------------------------------------------------------------------

create table public.family_branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(btrim(name)) between 1 and 200),
  description text check (char_length(description) <= 1000),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table public.profile_branches (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  branch_id  uuid not null references public.family_branches (id) on delete restrict,
  is_primary boolean not null default false,
  primary key (profile_id, branch_id)
);

create unique index profile_branches_one_primary on public.profile_branches (profile_id) where is_primary;
create index profile_branches_branch_idx on public.profile_branches (branch_id);

create table public.hobbies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table public.profile_hobbies (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  hobby_id   uuid not null references public.hobbies (id) on delete cascade,
  primary key (profile_id, hobby_id)
);

create index profile_hobbies_hobby_idx on public.profile_hobbies (hobby_id);


-- -----------------------------------------------------------------------------
-- Family relationships: genealogy only. Nothing here grants any permission.
--   parent:  person_a is the parent of person_b
--   partner: person_a and person_b are partners (stored once, smaller id first)
-- -----------------------------------------------------------------------------

create table public.family_relationships (
  id           uuid primary key default gen_random_uuid(),
  relationship public.relationship_type not null,
  person_a     uuid not null references public.profiles (id) on delete cascade,
  person_b     uuid not null references public.profiles (id) on delete cascade,
  detail       text not null default 'unspecified',
  start_year   smallint check (start_year between 1800 and 2200),
  end_year     smallint check (end_year between 1800 and 2200),
  created_by   uuid references public.accounts (id) on delete set null,
  created_at   timestamptz not null default now(),

  check (person_a <> person_b),
  check (
    (relationship = 'parent'  and detail in ('biological', 'adoptive', 'step', 'foster', 'unspecified')) or
    (relationship = 'partner' and detail in ('married', 'partnered', 'former', 'unspecified'))
  ),
  check (relationship <> 'partner' or person_a < person_b),
  unique (relationship, person_a, person_b)
);

create index family_relationships_person_b_idx on public.family_relationships (person_b);


-- -----------------------------------------------------------------------------
-- Profile managers: which accounts may edit which child profiles.
-- Removed guardians are marked revoked, never erased.
-- -----------------------------------------------------------------------------

create table public.profile_managers (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  account_id    uuid not null references public.accounts (id) on delete cascade,
  role          public.manager_role not null default 'guardian',
  granted_by    uuid references public.accounts (id) on delete set null,
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  revoked_by    uuid references public.accounts (id) on delete set null,
  revoke_reason text check (char_length(revoke_reason) <= 500)
);

create unique index profile_managers_one_active
  on public.profile_managers (profile_id, account_id) where revoked_at is null;
create index profile_managers_account_idx
  on public.profile_managers (account_id) where revoked_at is null;


-- -----------------------------------------------------------------------------
-- Invitations: single-use links. Only a SHA-256 fingerprint of the link's
-- secret is stored, so a database leak would not expose working links.
-- -----------------------------------------------------------------------------

create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  kind            public.invitation_kind not null,
  token_hash      bytea not null unique,
  profile_id      uuid references public.profiles (id) on delete cascade,
  recipient_label text check (char_length(recipient_label) <= 200),
  created_by      uuid references public.accounts (id) on delete set null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  accepted_at     timestamptz,
  accepted_by     uuid references public.accounts (id) on delete set null,
  revoked_at      timestamptz,
  revoked_by      uuid references public.accounts (id) on delete set null,

  check ((kind = 'join') = (profile_id is null))
);


-- -----------------------------------------------------------------------------
-- Requests: claiming a profile without an invitation (an admin decides), or
-- asking to co-manage a child (an existing guardian or an admin decides).
-- -----------------------------------------------------------------------------

create table public.profile_requests (
  id           uuid primary key default gen_random_uuid(),
  kind         public.request_kind not null,
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  requester_id uuid not null references public.accounts (id) on delete cascade,
  message      text check (char_length(message) <= 1000),
  status       public.request_status not null default 'pending',
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references public.accounts (id) on delete set null
);

create unique index profile_requests_one_pending
  on public.profile_requests (profile_id, requester_id, kind) where status = 'pending';


-- -----------------------------------------------------------------------------
-- Audit log: append-only. No one can change or delete entries, admins included.
-- No foreign keys, so history survives even if the referenced rows are removed.
-- -----------------------------------------------------------------------------

create table public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor_id   uuid,
  action     text not null,
  profile_id uuid,
  account_id uuid,
  details    jsonb not null default '{}'::jsonb
);

create index audit_log_at_idx on public.audit_log (at desc);

create function public.audit_log_is_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log_is_append_only';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.audit_log_is_append_only();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_is_append_only();

create function public.write_audit(
  p_action     text,
  p_profile_id uuid default null,
  p_account_id uuid default null,
  p_details    jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, profile_id, account_id, details)
  values (auth.uid(), p_action, p_profile_id, p_account_id, coalesce(p_details, '{}'::jsonb));
$$;


-- -----------------------------------------------------------------------------
-- Permission helpers. These are the only place permission rules are written.
-- -----------------------------------------------------------------------------

create function public.is_active_member()
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.accounts
    where id = auth.uid() and status = 'active'
  );
$$;

create function public.is_admin()
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.accounts
    where id = auth.uid() and status = 'active' and role = 'admin'
  );
$$;

create function public.is_guardian_of(p_profile_id uuid)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select public.is_active_member() and exists (
    select 1 from public.profile_managers m
    where m.profile_id = p_profile_id
      and m.account_id = auth.uid()
      and m.revoked_at is null
  );
$$;

-- The one rule: an active account may edit a profile if it is their own,
-- they are an active guardian of it, or they are an admin.
-- Family relationships play no part in this.
create function public.can_edit_profile(p_profile_id uuid)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select public.is_active_member() and (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = p_profile_id and p.account_id = auth.uid() and p.archived_at is null
    )
    or public.is_guardian_of(p_profile_id)
  );
$$;

create function public.my_profile_id()
returns uuid
language sql stable
security definer
set search_path = ''
as $$
  select id from public.profiles where account_id = auth.uid();
$$;

create function public.require_active_member()
returns void
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_member() then
    raise exception 'not_signed_in';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Every new sign-in user gets an account row.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.accounts (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create function public.profiles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_before_write
  before insert or update on public.profiles
  for each row execute function public.profiles_before_write();

-- Record which fields changed (names only, so the log does not copy personal data).
create function public.profiles_audit_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[];
begin
  select array_agg(n.key order by n.key) into changed
  from jsonb_each(to_jsonb(new)) n
  join jsonb_each(to_jsonb(old)) o using (key)
  where n.value is distinct from o.value
    and n.key not in ('updated_at', 'updated_by');

  if changed is not null then
    perform public.write_audit('profile.updated', new.id, null, jsonb_build_object('fields', changed));
  end if;
  return new;
end;
$$;

create trigger profiles_audit_update
  after update on public.profiles
  for each row execute function public.profiles_audit_update();

-- Guardianship only applies to child profiles, with a cap per child.
create function public.profile_managers_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ptype public.profile_type;
  active_count integer;
  cap smallint;
begin
  select profile_type into ptype from public.profiles where id = new.profile_id;
  if ptype is distinct from 'child' then
    raise exception 'guardians_only_for_children';
  end if;

  select max_guardians into cap from public.app_settings;
  select count(*) into active_count
  from public.profile_managers
  where profile_id = new.profile_id and revoked_at is null;
  if active_count >= cap then
    raise exception 'too_many_guardians';
  end if;
  return new;
end;
$$;

create trigger profile_managers_before_insert
  before insert on public.profile_managers
  for each row execute function public.profile_managers_before_insert();


-- -----------------------------------------------------------------------------
-- Directory view: what members see. Hidden fields come back empty unless the
-- viewer may edit the profile. Signed-out and deactivated users see nothing.
-- -----------------------------------------------------------------------------

create view public.directory_profiles
with (security_barrier = true)
as
select
  p.id,
  p.full_name,
  p.aka,
  p.profile_type,
  p.is_living,
  (p.account_id is not null) as is_claimed,
  coalesce(p.account_id = auth.uid(), false) as is_me,
  e.can_edit,
  case when e.can_edit or p.location_visibility   = 'members' then p.city          end as city,
  case when e.can_edit or p.location_visibility   = 'members' then p.state         end as state,
  case when e.can_edit or p.photo_visibility      = 'members' then p.photo_path    end as photo_path,
  case when e.can_edit or p.birthday_visibility   = 'members' then p.birth_month   end as birth_month,
  case when e.can_edit or p.birthday_visibility   = 'members' then p.birth_day     end as birth_day,
  case when e.can_edit or p.birth_year_visibility = 'members' then p.birth_year    end as birth_year,
  case when e.can_edit or p.email_visibility      = 'members' then p.contact_email end as contact_email,
  case when e.can_edit or p.phone_visibility      = 'members' then p.phone         end as phone,
  case when e.can_edit or p.social_visibility     = 'members' then p.instagram     end as instagram,
  case when e.can_edit or p.social_visibility     = 'members' then p.linkedin      end as linkedin,
  case when e.can_edit or p.social_visibility     = 'members' then p.website       end as website,
  p.updated_at
from public.profiles p
cross join lateral (select public.can_edit_profile(p.id) as can_edit) e
where p.archived_at is null
  and public.is_active_member();


-- -----------------------------------------------------------------------------
-- Actions members can take. Each checks permissions itself and writes to the
-- audit log. Multi-step changes happen all at once or not at all.
-- -----------------------------------------------------------------------------

-- A newly joined adult creates their own profile.
create function public.create_my_profile(
  p_full_name text,
  p_aka       text default null,
  p_city      text default null,
  p_state     text default null,
  p_branch_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  perform public.require_active_member();
  if public.my_profile_id() is not null then
    raise exception 'already_has_profile';
  end if;

  insert into public.profiles (account_id, full_name, aka, city, state, source)
  values (auth.uid(), btrim(p_full_name), nullif(btrim(p_aka), ''), nullif(btrim(p_city), ''),
          nullif(btrim(p_state), ''), 'self')
  returning id into new_id;

  if p_branch_id is not null then
    insert into public.profile_branches (profile_id, branch_id, is_primary)
    values (new_id, p_branch_id, true);
  end if;

  perform public.write_audit('profile.created_self', new_id, auth.uid());
  return new_id;
end;
$$;

-- A parent or guardian adds a child. This creates the child profile, a
-- guardian permission for the caller and, only if the caller says they are a
-- parent, a separate parent relationship.
create function public.create_child_profile(
  p_full_name     text,
  p_birth_year    integer,
  p_birth_month   integer default null,
  p_birth_day     integer default null,
  p_aka           text default null,
  p_parent_detail text default null  -- 'biological' | 'adoptive' | 'step' | 'foster' | 'unspecified' | null (not a parent)
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me_profile uuid;
  child_id uuid;
begin
  perform public.require_active_member();
  me_profile := public.my_profile_id();
  if me_profile is null then
    raise exception 'create_your_profile_first';
  end if;
  if p_birth_year is null then
    raise exception 'child_birth_year_required';
  end if;

  insert into public.profiles (
    profile_type, full_name, aka, birth_year, birth_month, birth_day, source,
    location_visibility, birthday_visibility, birth_year_visibility
  )
  values (
    'child', btrim(p_full_name), nullif(btrim(p_aka), ''), p_birth_year, p_birth_month, p_birth_day,
    'guardian', 'private', 'private', 'private'
  )
  returning id into child_id;

  -- Start the child in the caller's main branch.
  insert into public.profile_branches (profile_id, branch_id, is_primary)
  select child_id, branch_id, true
  from public.profile_branches
  where profile_id = me_profile and is_primary;

  insert into public.profile_managers (profile_id, account_id, granted_by)
  values (child_id, auth.uid(), auth.uid());

  if p_parent_detail is not null then
    insert into public.family_relationships (relationship, person_a, person_b, detail, created_by)
    values ('parent', me_profile, child_id, p_parent_detail, auth.uid());
  end if;

  perform public.write_audit('child.created', child_id, auth.uid(),
    jsonb_build_object('parent_detail', p_parent_detail));
  return child_id;
end;
$$;

-- Look up or add a hobby by name, so "Gardening" and "gardening " match.
create function public.ensure_hobby(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  hobby_slug text := public.slugify(p_name);
  hobby_id uuid;
begin
  perform public.require_active_member();
  if hobby_slug = '' then
    raise exception 'hobby_name_required';
  end if;

  insert into public.hobbies (name, slug)
  values (btrim(p_name), hobby_slug)
  on conflict (slug) do nothing;

  select id into hobby_id from public.hobbies where slug = hobby_slug;
  return hobby_id;
end;
$$;

-- Creates an invitation and returns its secret once. Only the fingerprint is kept.
--   join:        any active member (if allowed in settings) or an admin
--   claim:       an admin for an unclaimed adult; a guardian or admin to hand a child's profile over (age 13+)
--   co_guardian: a guardian of the child or an admin
create function public.create_invitation(
  p_kind            public.invitation_kind,
  p_profile_id      uuid default null,
  p_recipient_label text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.app_settings;
  target public.profiles;
  secret text;
begin
  perform public.require_active_member();
  select * into settings from public.app_settings;

  if p_kind = 'join' then
    if p_profile_id is not null then
      raise exception 'join_invitations_have_no_profile';
    end if;
    if not (public.is_admin() or settings.members_can_invite) then
      raise exception 'not_allowed';
    end if;
  else
    select * into target from public.profiles where id = p_profile_id;
    if target.id is null or target.archived_at is not null then
      raise exception 'profile_not_found';
    end if;

    if p_kind = 'claim' then
      if target.account_id is not null then
        raise exception 'profile_already_claimed';
      end if;
      if not target.is_living then
        raise exception 'memorial_profiles_cannot_be_claimed';
      end if;
      if target.profile_type = 'adult' and not public.is_admin() then
        raise exception 'not_allowed';
      end if;
      if target.profile_type = 'child' and not public.is_admin() then
        if not public.is_guardian_of(target.id) then
          raise exception 'not_allowed';
        end if;
        if target.birth_year is null or extract(year from now())::int - target.birth_year < 13 then
          raise exception 'too_young_for_handover';
        end if;
      end if;
    elsif p_kind = 'co_guardian' then
      if target.profile_type <> 'child' then
        raise exception 'guardians_only_for_children';
      end if;
      if not (public.is_admin() or public.is_guardian_of(target.id)) then
        raise exception 'not_allowed';
      end if;
    end if;
  end if;

  -- Two random UUIDs give about 244 bits of randomness.
  secret := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.invitations (kind, token_hash, profile_id, recipient_label, created_by, expires_at)
  values (p_kind, sha256(convert_to(secret, 'UTF8')), p_profile_id, nullif(btrim(p_recipient_label), ''),
          auth.uid(), now() + make_interval(days => settings.invitation_days));

  perform public.write_audit('invitation.created', p_profile_id, null,
    jsonb_build_object('kind', p_kind, 'recipient_label', p_recipient_label));
  return secret;
end;
$$;

-- Internal: link an account to an unclaimed profile. For a child profile this
-- is the hand-over: it becomes an adult profile, all guardians are revoked and
-- privacy resets to hidden so the new owner decides what to share.
create function public.link_profile_to_account(p_profile_id uuid, p_account_id uuid, p_via text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles;
begin
  select * into target from public.profiles where id = p_profile_id for update;
  if target.id is null or target.archived_at is not null then
    raise exception 'profile_not_found';
  end if;
  if target.account_id is not null then
    raise exception 'profile_already_claimed';
  end if;
  if not target.is_living then
    raise exception 'memorial_profiles_cannot_be_claimed';
  end if;
  if exists (select 1 from public.profiles where account_id = p_account_id) then
    raise exception 'already_has_profile';
  end if;

  if target.profile_type = 'child' then
    update public.profiles set
      profile_type          = 'adult',
      account_id            = p_account_id,
      location_visibility   = 'private',
      photo_visibility      = 'private',
      birthday_visibility   = 'private',
      birth_year_visibility = 'private',
      email_visibility      = 'private',
      phone_visibility      = 'private',
      social_visibility     = 'private'
    where id = p_profile_id;

    update public.profile_managers set
      revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'handed_over'
    where profile_id = p_profile_id and revoked_at is null;

    perform public.write_audit('profile.handed_over', p_profile_id, p_account_id, jsonb_build_object('via', p_via));
  else
    update public.profiles set account_id = p_account_id where id = p_profile_id;
    perform public.write_audit('profile.claimed', p_profile_id, p_account_id, jsonb_build_object('via', p_via));
  end if;
end;
$$;

-- Internal: give an account guardian rights over a child.
create function public.grant_guardian(p_profile_id uuid, p_account_id uuid, p_via text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.profile_managers
    where profile_id = p_profile_id and account_id = p_account_id and revoked_at is null
  ) then
    raise exception 'already_guardian';
  end if;

  insert into public.profile_managers (profile_id, account_id, granted_by)
  values (p_profile_id, p_account_id, auth.uid());

  perform public.write_audit('guardian.added', p_profile_id, p_account_id, jsonb_build_object('via', p_via));
end;
$$;

-- The signed-in person accepts an invitation.
create function public.accept_invitation(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invitations;
begin
  perform public.require_active_member();

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
  perform public.write_audit('invitation.accepted', inv.profile_id, auth.uid(), jsonb_build_object('kind', inv.kind));

  return jsonb_build_object('kind', inv.kind, 'profile_id', inv.profile_id);
end;
$$;

create function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_active_member();
  update public.invitations set revoked_at = now(), revoked_by = auth.uid()
  where id = p_invitation_id
    and accepted_at is null and revoked_at is null
    and (created_by = auth.uid() or public.is_admin());
  if not found then
    raise exception 'not_allowed';
  end if;
  perform public.write_audit('invitation.revoked', null, null, jsonb_build_object('invitation_id', p_invitation_id));
end;
$$;

-- "This is me" on an unclaimed profile, without an invitation. An admin decides.
create function public.request_profile_claim(p_profile_id uuid, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles;
  request_id uuid;
begin
  perform public.require_active_member();
  if public.my_profile_id() is not null then
    raise exception 'already_has_profile';
  end if;
  select * into target from public.profiles where id = p_profile_id;
  if target.id is null or target.archived_at is not null then
    raise exception 'profile_not_found';
  end if;
  if target.profile_type <> 'adult' or target.account_id is not null or not target.is_living then
    raise exception 'profile_not_claimable';
  end if;

  insert into public.profile_requests (kind, profile_id, requester_id, message)
  values ('claim', p_profile_id, auth.uid(), p_message)
  returning id into request_id;

  perform public.write_audit('request.claim_created', p_profile_id, auth.uid());
  return request_id;
end;
$$;

-- "Request to co-manage" a child already in the directory. A guardian decides.
create function public.request_co_guardianship(p_profile_id uuid, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id uuid;
begin
  perform public.require_active_member();
  if (select profile_type from public.profiles where id = p_profile_id and archived_at is null) is distinct from 'child' then
    raise exception 'guardians_only_for_children';
  end if;
  if public.is_guardian_of(p_profile_id) then
    raise exception 'already_guardian';
  end if;

  insert into public.profile_requests (kind, profile_id, requester_id, message)
  values ('co_guardian', p_profile_id, auth.uid(), p_message)
  returning id into request_id;

  perform public.write_audit('request.co_guardian_created', p_profile_id, auth.uid());
  return request_id;
end;
$$;

create function public.decide_profile_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.profile_requests;
begin
  perform public.require_active_member();
  select * into req from public.profile_requests where id = p_request_id for update;
  if req.id is null or req.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;

  if req.kind = 'claim' and not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  if req.kind = 'co_guardian' and not (public.is_admin() or public.is_guardian_of(req.profile_id)) then
    raise exception 'not_allowed';
  end if;

  if p_approve then
    if not exists (select 1 from public.accounts where id = req.requester_id and status = 'active') then
      raise exception 'requester_not_active';
    end if;
    if req.kind = 'claim' then
      perform public.link_profile_to_account(req.profile_id, req.requester_id, 'request');
    else
      perform public.grant_guardian(req.profile_id, req.requester_id, 'request');
    end if;
  end if;

  update public.profile_requests set
    status = case when p_approve then 'approved'::public.request_status else 'denied'::public.request_status end,
    decided_at = now(), decided_by = auth.uid()
  where id = p_request_id;

  perform public.write_audit(case when p_approve then 'request.approved' else 'request.denied' end,
    req.profile_id, req.requester_id, jsonb_build_object('kind', req.kind));
end;
$$;

create function public.cancel_profile_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_active_member();
  update public.profile_requests set status = 'cancelled', decided_at = now(), decided_by = auth.uid()
  where id = p_request_id and requester_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'not_allowed';
  end if;
end;
$$;

-- Guardians may step down themselves, but cannot remove each other.
-- Only an admin can remove another guardian.
create function public.remove_guardian(p_profile_id uuid, p_account_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_active_member();
  if not (public.is_admin() or (p_account_id = auth.uid() and public.is_guardian_of(p_profile_id))) then
    raise exception 'not_allowed';
  end if;

  update public.profile_managers set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = p_reason
  where profile_id = p_profile_id and account_id = p_account_id and revoked_at is null;
  if not found then
    raise exception 'not_a_guardian';
  end if;

  perform public.write_audit('guardian.removed', p_profile_id, p_account_id, jsonb_build_object('reason', p_reason));
end;
$$;


-- -----------------------------------------------------------------------------
-- Admin actions
-- -----------------------------------------------------------------------------

create function public.require_admin()
returns void
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
end;
$$;

create function public.admin_set_account_status(p_account_id uuid, p_status public.account_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  if p_status = 'deactivated' and exists (
    select 1 from public.accounts where id = p_account_id and role = 'admin' and status = 'active'
  ) and (select count(*) from public.accounts where role = 'admin' and status = 'active') <= 1 then
    raise exception 'cannot_remove_last_admin';
  end if;

  update public.accounts set
    status = p_status,
    deactivated_at = case when p_status = 'deactivated' then now() end,
    deactivated_by = case when p_status = 'deactivated' then auth.uid() end
  where id = p_account_id;
  if not found then
    raise exception 'account_not_found';
  end if;

  perform public.write_audit('account.' || p_status::text, null, p_account_id);
end;
$$;

create function public.admin_set_account_role(p_account_id uuid, p_role public.account_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  if p_role = 'member' and exists (
    select 1 from public.accounts where id = p_account_id and role = 'admin' and status = 'active'
  ) and (select count(*) from public.accounts where role = 'admin' and status = 'active') <= 1 then
    raise exception 'cannot_remove_last_admin';
  end if;

  update public.accounts set role = p_role where id = p_account_id;
  if not found then
    raise exception 'account_not_found';
  end if;

  perform public.write_audit('account.role_set', null, p_account_id, jsonb_build_object('role', p_role));
end;
$$;

create function public.admin_add_guardian(p_profile_id uuid, p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  perform public.grant_guardian(p_profile_id, p_account_id, 'admin');
end;
$$;

-- Undo a mistaken claim: the profile becomes unclaimed again.
create function public.admin_unlink_profile(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous uuid;
begin
  perform public.require_admin();
  select account_id into previous from public.profiles where id = p_profile_id for update;
  if previous is null then
    raise exception 'profile_not_claimed';
  end if;
  update public.profiles set account_id = null where id = p_profile_id;
  perform public.write_audit('profile.unlinked', p_profile_id, previous);
end;
$$;

-- Mark a profile as a memorial, or archive / restore it (nothing is deleted).
create function public.admin_set_profile_status(p_profile_id uuid, p_is_living boolean, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.profiles set
    is_living = p_is_living,
    archived_at = case when p_archived then coalesce(archived_at, now()) end
  where id = p_profile_id;
  if not found then
    raise exception 'profile_not_found';
  end if;
  perform public.write_audit('profile.status_set', p_profile_id, null,
    jsonb_build_object('is_living', p_is_living, 'archived', p_archived));
end;
$$;


-- -----------------------------------------------------------------------------
-- Row-level security: the database itself refuses anything not allowed here.
-- -----------------------------------------------------------------------------

alter table public.app_settings         enable row level security;
alter table public.accounts             enable row level security;
alter table public.profiles             enable row level security;
alter table public.family_branches      enable row level security;
alter table public.profile_branches     enable row level security;
alter table public.hobbies              enable row level security;
alter table public.profile_hobbies      enable row level security;
alter table public.family_relationships enable row level security;
alter table public.profile_managers     enable row level security;
alter table public.invitations          enable row level security;
alter table public.profile_requests     enable row level security;
alter table public.audit_log            enable row level security;

create policy app_settings_read   on public.app_settings for select to authenticated using (public.is_active_member());
create policy app_settings_update on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy accounts_read on public.accounts for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Full profile rows: only the person, their guardians and admins.
-- Everyone else reads directory_profiles.
create policy profiles_read on public.profiles for select to authenticated
  using (public.can_edit_profile(id));
create policy profiles_admin_insert on public.profiles for insert to authenticated
  with check (public.is_admin() and account_id is null);
create policy profiles_update on public.profiles for update to authenticated
  using (public.can_edit_profile(id)) with check (public.can_edit_profile(id));

create policy family_branches_read   on public.family_branches for select to authenticated using (public.is_active_member());
create policy family_branches_insert on public.family_branches for insert to authenticated with check (public.is_admin());
create policy family_branches_update on public.family_branches for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy profile_branches_read   on public.profile_branches for select to authenticated using (public.is_active_member());
create policy profile_branches_insert on public.profile_branches for insert to authenticated with check (public.can_edit_profile(profile_id));
create policy profile_branches_update on public.profile_branches for update to authenticated
  using (public.can_edit_profile(profile_id)) with check (public.can_edit_profile(profile_id));
create policy profile_branches_delete on public.profile_branches for delete to authenticated using (public.can_edit_profile(profile_id));

create policy hobbies_read on public.hobbies for select to authenticated using (public.is_active_member());

create policy profile_hobbies_read   on public.profile_hobbies for select to authenticated using (public.is_active_member());
create policy profile_hobbies_insert on public.profile_hobbies for insert to authenticated with check (public.can_edit_profile(profile_id));
create policy profile_hobbies_delete on public.profile_hobbies for delete to authenticated using (public.can_edit_profile(profile_id));

create policy family_relationships_read   on public.family_relationships for select to authenticated using (public.is_active_member());
create policy family_relationships_insert on public.family_relationships for insert to authenticated with check (public.is_admin());
create policy family_relationships_delete on public.family_relationships for delete to authenticated using (public.is_admin());

create policy profile_managers_read on public.profile_managers for select to authenticated
  using (account_id = auth.uid() or public.can_edit_profile(profile_id));

create policy invitations_read on public.invitations for select to authenticated
  using (created_by = auth.uid() or public.is_admin());

create policy profile_requests_read on public.profile_requests for select to authenticated
  using (
    requester_id = auth.uid()
    or public.is_admin()
    or (kind = 'co_guardian' and public.is_guardian_of(profile_id))
  );

create policy audit_log_read on public.audit_log for select to authenticated using (public.is_admin());


-- -----------------------------------------------------------------------------
-- Privileges. Start from nothing, then grant only what is needed.
-- Signed-out visitors (anon) get no access to anything.
-- -----------------------------------------------------------------------------

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on public.directory_profiles to authenticated;

grant select on public.app_settings to authenticated;
grant update (members_can_invite, invitation_days, max_guardians) on public.app_settings to authenticated;

grant select on public.accounts to authenticated;

grant select, insert on public.profiles to authenticated;
-- Only ordinary profile fields can be edited directly. Ownership, type,
-- memorial and archive status change only through the functions above.
grant update (
  full_name, aka, birth_year, birth_month, birth_day, city, state, photo_path,
  contact_email, phone, instagram, linkedin, website,
  location_visibility, photo_visibility, birthday_visibility, birth_year_visibility,
  email_visibility, phone_visibility, social_visibility
) on public.profiles to authenticated;

grant select, insert on public.family_branches to authenticated;
grant update (name, description, sort_order) on public.family_branches to authenticated;
grant select, insert, delete on public.profile_branches to authenticated;
grant update (is_primary) on public.profile_branches to authenticated;
grant select on public.hobbies to authenticated;
grant select, insert, delete on public.profile_hobbies to authenticated;
grant select, insert, delete on public.family_relationships to authenticated;
grant select on public.profile_managers to authenticated;
grant select on public.invitations to authenticated;
grant select on public.profile_requests to authenticated;
grant select on public.audit_log to authenticated;

-- Helpers used inside policies, constraints and the directory view.
grant execute on function
  public.is_valid_birthday(smallint, smallint, smallint),
  public.slugify(text),
  public.is_active_member(),
  public.is_admin(),
  public.is_guardian_of(uuid),
  public.can_edit_profile(uuid),
  public.my_profile_id()
to authenticated;

-- Member and admin actions (each checks permissions itself).
grant execute on function
  public.create_my_profile(text, text, text, text, uuid),
  public.create_child_profile(text, integer, integer, integer, text, text),
  public.ensure_hobby(text),
  public.create_invitation(public.invitation_kind, uuid, text),
  public.accept_invitation(text),
  public.revoke_invitation(uuid),
  public.request_profile_claim(uuid, text),
  public.request_co_guardianship(uuid, text),
  public.decide_profile_request(uuid, boolean),
  public.cancel_profile_request(uuid),
  public.remove_guardian(uuid, uuid, text),
  public.admin_set_account_status(uuid, public.account_status),
  public.admin_set_account_role(uuid, public.account_role),
  public.admin_add_guardian(uuid, uuid),
  public.admin_unlink_profile(uuid),
  public.admin_set_profile_status(uuid, boolean, boolean)
to authenticated;
