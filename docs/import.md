# Importing from Airtable

The original directory's export lives only in `private-data/` (never in git).

## 1. Dry run

```bash
npm run import:dry-run -- private-data/<export>.csv
```

Changes nothing online. Writes to `private-data/import/`:

- `report.md`: every record, what will happen, errors (⛔) and warnings (⚠️)
- `import.sql`: the database changes
- `photos/`: downloaded photos, resized to at most 1024px

Airtable's photo links expire within hours of exporting. If the report says
"link expired", export a fresh CSV and run the dry run again.

## 2. Decisions

Fix errors in `private-data/import/decisions.json`, keyed by the import key
shown in the report:

```json
{
  "airtable:pat-example": { "birthday": "9/3/1975" },
  "airtable:sam-example": { "mergeInto": "<existing profile id>" },
  "airtable:old-entry": { "skip": true }
}
```

- `birthday`: replaces the exported birthday ("M/D/YYYY", "M/D", or `null`)
- `profileType`: `"adult"` or `"child"`, if the birthday doesn't tell
- `mergeInto`: fill in an existing profile (only its empty fields) instead of creating one
- `skip`: leave the record out

Run the dry run again until the report shows no errors.

## 3. Apply (after review)

```bash
npx supabase db query --linked -f private-data/import/import.sql
```

Then upload the photos (each file is named after its profile id):

```bash
for f in private-data/import/photos/*.jpg; do npx supabase storage cp "$f" "ss:///profile-photos/$(basename "$f" .jpg)/airtable.jpg" --linked --experimental; done
```

Importing again is safe: records match by import key, existing records are
updated, and a profile that someone has claimed is never overwritten.
