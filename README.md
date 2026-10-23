# Bryan Family Directory

A private, invitation-only directory that helps our extended family find one
another, see where relatives live, and share contact details they choose to share.

## Status

| Milestone | State |
|---|---|
| M1 Foundation: database, permissions, tests | done (live in Supabase, 47 tests) |
| M2 Sign-in and enrollment | in progress (works on this Mac; needs a domain to email relatives) |
| M3 Import the 8 Airtable profiles | not started |
| M4 Directory | not started |
| M5 Profiles and children | not started |
| M6 Admin | not started |
| M7 Pilot | not started |
| M8 Launch | not started |

## How it is built

- **Next.js + TypeScript + Tailwind**: the website.
- **Supabase**: one Postgres database, sign-in and photo storage.
- **Vercel**: hosting (free plan, personal use).
- **Resend**: sends the sign-in code emails.

The database enforces every permission itself (row-level security), so hiding a
button in the app is never the only protection. See
[docs/data-model.md](docs/data-model.md) for how the data and permissions fit together.

## Family data never goes in this repository

Real family information (the Airtable export, photos, backups) stays out of
git. `.gitignore` blocks `.csv`, `.xlsx`, `private-data/` and `backups/`.
Keep exports in `private-data/`, which exists only on your computer.

Tests use made-up people only.

## Everyday commands

Run these from this folder in Terminal.

```bash
npm test
```
Runs the automated permission tests (about 5 seconds, no internet needed).

```bash
npm run dev
```
Starts the website on your computer at http://localhost:3000.

```bash
npm run typecheck
```
Checks the code for type mistakes.

## Changing the live database

Database changes are new files in `supabase/migrations/`. To apply one:

1. Run `npm test`. All tests must pass.
2. Preview it. This changes nothing:
   ```bash
   npx supabase db push --linked --dry-run
   ```
3. Apply it, once the preview shows only the expected file:
   ```bash
   npx supabase db push --linked
   ```
4. Run Supabase's security checker:
   ```bash
   npx supabase db advisors --linked --type security
   ```
   Expect only the "Signed-In Users Can Execute SECURITY DEFINER Function"
   warnings for the intended member actions.

## Folder guide

- `supabase/migrations/`: the database design, applied in filename order. Never
  edit a migration that has already been applied to the live database; add a
  new one instead.
- `tests/db/`: permission tests that run the real migrations in a temporary
  in-memory database.
- `src/`: the website.
- `docs/`: design notes and procedures.
