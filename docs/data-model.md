# Data model and permissions

Schema: [`supabase/migrations/20261021000001_foundation.sql`](../supabase/migrations/20261021000001_foundation.sql).
Tests: [`tests/db/`](../tests/db/).

## Three questions, three places

| Question | Table | Notes |
|---|---|---|
| Who can sign in? | `accounts` | One row per sign-in user. Role `member` or `admin`; status `active` or `deactivated`. The sign-in email stays in Supabase's `auth.users`. |
| Who is in the family? | `profiles` | Everyone: adults, children, deceased relatives, people who never sign in. `account_id` is set only when the profile *is* that account holder (unique: one "me" per account). |
| Who is related to whom? | `family_relationships` | `parent` (biological, adoptive, step, foster) and `partner` (married, partnered, former). Genealogy only: grants no permissions. |
| Who may edit which child? | `profile_managers` | Guardian permissions. Child profiles only, up to 4 active guardians, each with their own login. Revoked rows are kept. |

Supporting tables: `family_branches` / `profile_branches` (a person may be in
more than one branch, one primary), `hobbies` / `profile_hobbies` (normalized
tags), `invitations`, `profile_requests`, `audit_log`, `app_settings`.

## The permission rule

`can_edit_profile(profile)` is true only when the signed-in account is **active** and:

1. it is their own profile, or
2. they hold an active guardian permission for it, or
3. they are an admin.

Every policy on profiles, branches and hobbies uses this one function.

## What members can see

Members never read `profiles` directly; they read the `directory_profiles` view.
Fields the viewer may not see come back empty. Signed-out visitors and
deactivated accounts see nothing.

| Field group | Setting | Default (adult) | Default (child) |
|---|---|---|---|
| City, state | `location_visibility` | members | private |
| Photo | `photo_visibility` | members | members |
| Birthday month/day | `birthday_visibility` | members | private |
| Birth year | `birth_year_visibility` | private | always private |
| Email | `email_visibility` | private | cannot be stored |
| Phone | `phone_visibility` | private | cannot be stored |
| Instagram, LinkedIn, website | `social_visibility` | members | cannot be stored |

"Private" means visible only to the person, their guardians and admins.

## Children

- `create_child_profile` makes the child profile, a guardian permission for the
  caller and, only if the caller says they are a parent, a parent relationship.
- The database rejects contact details on child profiles and keeps a child's
  birth year private.
- A second guardian joins through a `co_guardian` invitation, or by requesting
  to co-manage (an existing guardian approves).
- Guardians can step down but cannot remove each other. Only admins can remove
  another guardian.
- **Hand-over:** a guardian (child 13+) or an admin creates a `claim`
  invitation. When the young adult accepts, the profile becomes an adult
  profile owned by them, all guardian permissions are revoked, and privacy
  resets to private. The profile never becomes adult automatically.

## Joining and claiming

| Invitation | Who can create it | What accepting does |
|---|---|---|
| `join` | Any active member (admins can turn this off), or an admin | Lets a new relative in; they then create their own profile |
| `claim` | Admin (unclaimed adult); guardian or admin (child hand-over) | Links that profile to the person accepting |
| `co_guardian` | A guardian of the child, or an admin | Gives the person accepting guardian rights |

Links are single-use and expire after 14 days. Only a SHA-256 fingerprint is
stored. Claiming a profile *without* an invitation creates a request that an
admin must approve.

## Audit log

Claims, hand-overs, guardian changes, invitations, account changes and profile
edits are recorded. Profile edits record which fields changed, not the values.
The log is append-only: the database refuses to change or delete entries.

## Admin-only actions

Deactivating and reactivating accounts, changing roles (the last admin cannot be
removed), adding or removing guardians, undoing a mistaken claim, marking a
profile as a memorial, archiving profiles (nothing is ever hard-deleted),
recording relationships, and managing branches.

## Rules for future changes

- Supabase grants new tables to app users automatically. Every new migration
  must revoke and re-grant explicitly, as the foundation migration does.
- Every new permission rule goes through `can_edit_profile` or a function that
  checks it, with a test in `tests/db/`.
