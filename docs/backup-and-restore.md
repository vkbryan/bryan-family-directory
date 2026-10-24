# Backups and restore

The free Supabase plan has no backups of its own, so the family directory
backs itself up every night with GitHub Actions
([`.github/workflows/nightly-backup.yml`](../.github/workflows/nightly-backup.yml)).

## What happens every night

1. **Save:** the whole database (structure and all data, including sign-in
   accounts and the audit log) and every profile photo.
2. **Practice restore:** loads the saved data into a throwaway copy of
   Supabase and checks it has the same number of profiles, accounts, sign-in
   users, photos and audit entries as the live database. If anything doesn't
   match, the run fails and GitHub emails you.
3. **Encrypt and keep:** everything is encrypted with your backup passphrase
   and kept for 30 days as a private download, visible only to people with
   access to the private repository.

The nightly connection also keeps the free Supabase project from pausing
after a week without visitors.

To back up right now: GitHub → the repository → **Actions** → **Nightly
backup** → **Run workflow**.

## Setup (once)

Three repository secrets, in GitHub → the repository → **Settings** →
**Secrets and variables** → **Actions** → **New repository secret**:

| Name | Where it comes from |
|---|---|
| `SUPABASE_DB_URL` | Supabase → **Connect** → **Session pooler** connection string, with your database password in place of `[YOUR-PASSWORD]` |
| `SUPABASE_ACCESS_TOKEN` | Supabase → your account → **Access Tokens** → **Generate new token** |
| `BACKUP_PASSPHRASE` | A long passphrase you make up. **Save it in your password manager.** Without it, backups can't be opened. |

## Checking backups are working

GitHub → **Actions** → **Nightly backup**. Each night should have a green
check. A red ✕ means something failed; open it to see which step. GitHub also
emails the repository owner about failures.

## Restoring

Only needed if data is lost or damaged. Ask for help if you can: restoring
replaces what's in the database.

1. **Download** the backup: Actions → Nightly backup → pick a night → under
   **Artifacts**, download `family-directory-backup-YYYY-MM-DD`. Unzip it to
   get the `.tar.gz.gpg` file.
2. **Decrypt** (needs GnuPG; you'll be asked for the passphrase):

   ```bash
   gpg --decrypt family-directory-backup-YYYY-MM-DD.tar.gz.gpg | tar -xzf -
   ```

   This creates a `backup/` folder: `roles.sql`, `schema.sql`, `data.sql`,
   `photos/`, `live-counts.txt`. Keep it in `private-data/`; it contains
   family information.
3. **Restore into a new, empty Supabase project** (the safest choice):
   create the project, then run, using its Session pooler connection string:

   ```bash
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file backup/roles.sql --file backup/schema.sql \
     --command 'SET session_replication_role = replica' \
     --file backup/data.sql --dbname "<new project connection string>"
   ```

4. **Restore photos** into the new project:

   ```bash
   npx supabase storage cp -r backup/photos ss:///profile-photos --project-ref <new ref> --experimental
   ```

5. **Point the website at the new project:** update the URL and publishable
   key (see `.env.example`), redo the dashboard settings in
   [supabase-setup.md](supabase-setup.md), and link the CLI to the new project
   (`npx supabase link --project-ref <new ref>`).

## Notes

- Backups made while someone is editing could differ by a row or two from the
  counts taken just before; the practice restore would then fail that night.
  If it passes the next night, there's nothing to worry about.
- GitHub keeps 30 nightly backups. For a longer-term copy, download one now
  and then and keep it in `private-data/` (never in git).
