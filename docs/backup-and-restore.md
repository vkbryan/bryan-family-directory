# Backups and restore

The nightly backup runs from a separate **private** repository,
[vkbryan/family-directory-backups](https://github.com/vkbryan/family-directory-backups),
so the encrypted backups stay private while this repository is public. That
repository's README covers what the backup does, its setup, how to check it,
and how to restore.

It checks out this repository each night and uses the scripts in
[`scripts/backup/`](../scripts/backup/): `counts.sql` and `verify-restore.sh`,
plus the Supabase config for the practice restore. Changing those scripts
changes the next night's backup.
