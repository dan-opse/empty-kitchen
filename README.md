# Meal Plan

Personal PWA that turns a grocery trip into three candidate weeks of lunch and dinner. Single user, no auth. Recipes are 1 serving = 1 meal.

## Setup

1. Create a Supabase project.
2. In the SQL editor, run [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql). That creates tables, unit conversions, RLS (service role only), and a private `receipts` storage bucket.
3. Copy [`.env.example`](.env.example) to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
CRON_SECRET=
```

Optional: `OPENAI_EXTRACT_MODEL` (default `gpt-5.4-mini`) and `OPENAI_SUMMARY_MODEL` (default `gpt-5.4-nano`).

4. Install and run:

```
npm install
npm run dev
```

5. Open `/import` and load the sample recipes, or run `npm run import:sample`.

The client never talks to Supabase. Next.js server code uses the service role so the receipts bucket can stay private without login.

## Daily receipt purge

Confirmed line items stay forever. The image/PDF and raw extract are deleted 14 days after `scan_date`.

- Vercel Cron hits `GET /api/cron/purge-receipts` daily (see `vercel.json`).
- Send `Authorization: Bearer $CRON_SECRET`.

## CSV import

Google Sheets is authoring-only. Export three CSVs with these headers:

- `ingredients.csv` — `ingredient_name,category,perishability,default_unit,aliases,is_staple`
- `recipes.csv` — `recipe_id,recipe_name,servings,prep_time_minutes,cuisine_tag,instructions,notes`
- `recipe_ingredients.csv` — `recipe_id,ingredient_name,quantity,unit,tier,substitute_for`

Upload them at `/import` or:

```
npm run import:csv -- --ingredients path/to/ingredients.csv --recipes path/to/recipes.csv --recipe-ingredients path/to/recipe_ingredients.csv
```

## PWA

Install from Safari or Chrome. The service worker caches the shell and `/api/plan/active` so the last selected week stays readable offline. Capture and generation need the network.
