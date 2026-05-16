# Manual / Archive SQL Scripts

These SQL scripts were written during development for one-off manual execution
against Supabase (via the Studio SQL editor or CLI). They are **not** applied
automatically by the Supabase migration runner.

## Canonical migration source

**Use supabase/migrations/ for all schema history.**
The timestamped .sql files there are the single source of truth for your
database structure and are applied in order by supabase db push / CI.

## When to use these scripts

- Backfilling data in production after a migration
- Running a one-time fix that does not need to be reproducible
- Reference / documentation of historical manual changes

## Adding new scripts

If you write a new manual script, add it here (not at the repo root) and
name it descriptively: <feature>-<action>.sql, e.g. credits-backfill-2026-05.sql.

For repeatable schema changes, create a proper migration instead:
`supabase migration new <name>`
