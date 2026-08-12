# Meal Prep Planner PWA — Product Requirements Document

## 1. Overview

A personal progressive web app that turns a grocery trip into a set of optimized weekly meal plans. The user shops, scans a receipt (or types a short ingredient list), and the system matches those ingredients against a personal recipe database to generate multiple candidate plans. Each plan covers **7 days from today**, **2 meals per day** (lunch and dinner, no breakfast) — **14 meal slots** — with a grocery usage breakdown, ranked by how efficiently they use what was bought and what is already in the kitchen.

This is a single-user, personal tool. No auth, no multi-tenant concerns, no payment flows. Recipes are written for **one person**. **1 serving = 1 meal**.

## 2. Goals

- Eliminate manual meal planning after a grocery trip.
- Reduce food waste by using as much of the purchased haul as possible, sequencing **cooks** around perishability, and keeping staple/pantry state honest.
- Give the user options, not one rigid plan: several candidate weeks from the same ingredient pool, then full freedom to rearrange, drop, or push meals after the fact.
- Make leftovers practical without requiring the user to know in advance whether they will cook extra.

## 3. Non-goals (out of scope for MVP)

- Multi-user support or accounts.
- Nutrition tracking or calorie counting.
- Live grocery store price integration.
- A budget / spend dashboard (store price on each receipt line now; do not build the view yet).
- Native mobile app (PWA only).
- In-app recipe authoring beyond the "add new recipe" side feature described in Section 8.
- A live inventory system that decrements ingredients when a meal is marked cooked.

## 4. Core user flow

1. User shops for groceries (first trip of the week, or a mid-week top-up).
2. User uploads a receipt **photo** (camera or library) or **PDF** (including iPhone document scans), **or** types a simple manual list if the file is unusable.
3. If a file was provided, it is stored (Section 6.6) and the system extracts raw line items (name, quantity/weight if present, price). PDFs may have multiple pages; all pages are read.
4. An LLM normalizes raw lines (or the short manual list) into canonical ingredient names, quantities, and units, using the master ingredient list and aliases. Quantities are converted into each ingredient's `default_unit` when the units are compatible (Section 6.2).
5. User gets a **final check** screen: add missing lines, delete junk lines, edit name/quantity/unit. Nothing is matched until they confirm.
6. Confirmed items are merged with **current pantry** (ingredients marked still-have, plus staples not marked ran-out). This combined pool is the available inventory.
7. System marks recipes feasible:
   - Every **required** ingredient is present in sufficient quantity in the combined pool (after unit conversion).
   - **Staples** are treated as present unless the staple tracker says ran-out.
   - Missing **optional** ingredients do not block feasibility; the recipe is flagged **modified**.
   - If a listed **substitute** is in the pool, auto-swap it onto the missing ingredient. If both the primary and a substitute are available, **prefer the staple / already-on-hand item** over a newly bought equivalent.
8. From the feasible pool, system generates **3 candidate plans** for a **7-day window starting today**. Each plan is a 14-slot lunch/dinner schedule with its own usage breakdown. Plans are scored on grocery utilization and cook sequencing, not on being recipe-disjoint.
9. User reviews candidates side by side, picks one as the **active plan** (or none). They can switch to another candidate from the same generation later.
10. The home screen is the active 14-slot week. The user can reorder meals, remove meals, or **push a meal back a day** (Section 5.3). They do not have to follow leftover suggestions.
11. After the week (or before the next scan), leftover purchased ingredients can be marked **Still have** / **Ran out**. The next scan merges still-have pantry above the new receipt items.

## 5. Feature: multi-plan generation (core MVP)

**What it does:** Returns several candidate weeks from the same feasible recipe pool, each a different way to spend the same bag of groceries. The user picks one, then edits it as the week plays out.

**Why multiple plans:** A single greedy pass tends to lock onto one cluster (everything chicken) and hide another valid week (pasta and veg) that may use the haul better. The three plans may **share recipes**. Distinctness means they emphasize **different purchased ingredients**, not three disjoint recipe lists.

**Window:** Day 1 is the generation date ("today"), not Monday. Lunch and dinner every day, 14 slots. Every recipe is eligible for any slot. Generation still prefers **higher `prep_time_minutes` on dinner**. The user can move any meal to any slot afterward.

**Cooks vs leftovers:** Target **5–8 unique recipes (cooks)** covering 14 slots by repeating a recipe on the **next day** when the plan suggests leftovers. Recipes are written as 1 serving / 1 meal; the user will not always know if they will cook extra. Treat consecutive repeats as a **suggestion** ("if you make extra, eat it tomorrow; if not, cook it again"). The same recipe **may be cooked more than once** in a week (not only as leftovers).

**Generation approach:**
- Identify feasible recipes against the combined pantry + receipt pool, with plan-level quantity checks (below).
- Build an ingredient-overlap score between recipe pairs (shared non-staple ingredients, weighted by quantity needed vs quantity available). Overlap is a helper so a week is not 14 unrelated dishes.
- Generate candidate clusters of about 5–8 recipes, using different seed recipes / clustering runs so candidates are not reshuffles of one core set.
- Expand each cluster onto 14 slots:
  - Sequence **cook** days by perishability (high-perishability ingredients cooked earlier).
  - Prefer leftover/repeat slots on the **next day** after a cook of the same recipe.
  - Prefer longer prep on dinner slots.
  - If the pool cannot fill 14 slots even with next-day repeats, **repeat cooks** of feasible recipes until the week is full.
- **Plan-level quantity constraint:** a recipe may be feasible alone and still illegal inside a cluster. The cluster as a whole must not use more of any required ingredient than the combined pool provides (converted to `default_unit`). Repeats/leftovers consume another serving's worth only when treated as a new cook; a suggested leftover slot does not consume a second serving of ingredients.
- Score each candidate on: grocery utilization (share of purchased quantity used, and how many purchased SKUs get used), perishability sequencing of cooks, and overlap as a tie-breaker. Do **not** require the three plans to be recipe-disjoint.
- Return the top 3, ranked by combined score, each with a short theme summary.

**Per-plan output:**
- 14-slot schedule (day 1–7 × lunch/dinner), with a leftover/repeat badge when a slot is a suggested next-day leftover.
- Grocery usage for that plan: used (quantity + unit), leftover/unused, and modified-recipe flags.
- Plain-language summary (e.g. "chicken and roasted veg forward; fish cooked early; longer prep on dinners").

### 5.1 Plan-level quantity accounting

Feasibility is checked twice:

1. **Per recipe** — can this dish be made from the current pool?
2. **Per plan** — can every **cook** in the cluster be made without over-committing the same ingredient?

Suggested leftover slots do not double-count ingredients. A second **cook** of the same recipe does.

### 5.2 Active plan display and switching

After selection, the main screen is the 14-slot week: recipe name, lunch/dinner, leftover badge, and ingredients for that cook (including substitute swaps and "modified" if optionals are missing).

The other candidates from that generation stay available. The user can switch the active plan to a different candidate at any time. Switching replaces the schedule; in-app edits on the previously active plan are not kept.

### 5.3 In-app schedule editing (core MVP)

Leftovers are uncertain, so the generated week is a starting point.

- **Reorder:** move any recipe to any other lunch/dinner slot.
- **Remove:** drop a recipe/slot the user does not want. Removing a cook may leave an empty slot; the user can leave it empty or move something else in.
- **Push back a day:** move the chosen meal to the same slot on the next day (lunch stays lunch). Following meals on that slot-chain shift later by one day. The meal that would fall off day 7 is **removed**.

These edits update the active plan only. They do not regenerate scores or re-run clustering unless the user starts a new generation (new scan or explicit regenerate).

## 6. Feature: receipt scanning, normalization, and matching (core MVP)

### 6.1 Capture

- Upload a receipt **image** (`jpeg`, `png`, `webp`, `heic`) from camera or photo library, or a **PDF** (iPhone Files / Notes “Scan Documents” is a first-class path). Multi-page PDFs are supported; every page is sent to extraction.
- Extract line items (name, quantity/weight if present, **price**).
- Price is stored for a future spend/budget view. **Do not build that view in MVP.**
- If the file is unusable or the user does not want to upload: **manual entry**. Expect a lazy, short list (e.g. "chicken, spinach, milk"). An LLM expands that into guessed canonical ingredients, quantities, and units for the confirm screen. The user fixes the guesses there.

### 6.2 Unit conversion

Before quantity checks, convert receipt qty and recipe qty into the ingredient's `default_unit`.

- **Compatible, auto-convert:** weight (`kg`, `g`, `lb`, `oz`) and volume (`l`, `ml`, `cup`, `tbsp`, `tsp`, `gal`, `fl oz`).
- **Count stays count:** `unit`, bunch, clove, etc.
- **Do not** convert weight ↔ volume (e.g. chicken `lb` → `cups`). Incompatible units go to the confirm screen for the user to fix.
- Conversion factors live in an app `unit_conversions` table (not a Google Sheet).

### 6.3 Confirm / final check

After normalization, the user must confirm before matching. They can:

- Edit ingredient, quantity, and unit.
- Delete a junk line.
- Add a line the image or guess missed.

### 6.4 Ingredient tiers and substitutes

Each recipe ingredient is one of:

- **staple** — assumed on hand unless the staple tracker is **ran out**. Not required on the receipt.
- **required** — must be in the combined pool in sufficient quantity.
- **optional** — missing does not block feasibility; schedule the recipe and mark it **modified**.

**Auto-swap:** if a required (or optional) ingredient is missing but a row with `substitute_for` pointing at it is in the pool, use the substitute. If both the primary and a substitute are available, prefer whichever is a **staple already marked in stock** (or otherwise already in pantry) over a newly purchased item.

### 6.5 Mid-week second trip

A new scan (or manual list) is allowed any day. Available ingredients = current pantry (still-have + in-stock staples) + newly confirmed items. The system generates a **new** 7-day, 14-slot plan window starting **that day**. Previous candidates are no longer the active generation; the user picks again from the new set of 3.

### 6.6 Receipt file storage and retention

The previous draft did **not** specify where receipt files live. They are not stored in Google Sheets and they are not stored as blobs in Postgres.

- **Where:** Supabase Storage bucket `receipts` (private). The `receipts` row holds the object path, MIME type, and original filename.
- **What is stored:** the uploaded image or PDF, plus `raw_ocr_text` for debugging while the file still exists. Manual entries have no file.
- **Retention:** auto-delete the **file** and **raw extract** **14 days** after `scan_date`. A scheduled job (daily) removes the Storage object, clears `storage_path` / `raw_ocr_text`, and sets `file_deleted_at`.
- **What is kept:** confirmed `receipt_items` (canonical name, qty, unit, price) and plan/pantry rows. Those are app data, not the receipt. Plans must keep working after the file is gone.
- **Why:** receipts can include store, payment, and barcode data. Two weeks is enough to debug a bad parse; after that the file should not sit around.

## 7. Data model

**Google Sheets is authoring-only** for recipes and the master ingredient list. Export CSV and import into the PWA. The app never writes receipts, plans, or pantry state back to Sheets.

CSV import seeds: `recipes`, `recipe_ingredients`, `ingredients`.

Everything in 7.4 onward is **app / Postgres tables**.

### 7.1 `recipes` (Sheet → CSV → app)

| Column | Type | Notes |
|---|---|---|
| recipe_id | text | Unique ID, e.g. `R001`. Stable, never reused. |
| recipe_name | text | Display name. |
| servings | number | Portions this recipe produces. **1 serving = 1 meal for this user.** Recipes are aimed at one person; typically `1`. |
| prep_time_minutes | number | Used in generation: higher prep prefers **dinner**. Also shown on the plan. |
| cuisine_tag | text | Optional, display only. Not used in scoring. |
| instructions | text | Freeform steps, optional for MVP. |
| notes | text | Optional. |

### 7.2 `recipe_ingredients` (Sheet → CSV → app)

One row per ingredient per recipe.

| Column | Type | Notes |
|---|---|---|
| recipe_id | text | Foreign key to `recipes.recipe_id`. |
| ingredient_name | text | Must match `ingredients.ingredient_name`. |
| quantity | number | Amount needed for the recipe's `servings`. |
| unit | text | Converted to `default_unit` at match time when compatible. |
| tier | text | One of: `staple`, `required`, `optional`. |
| substitute_for | text | Optional. Canonical name this row can replace. Auto-swapped when the primary is missing. |

### 7.3 `ingredients` (Sheet → CSV → app)

Master list for normalization, perishability, and staple tracking.

| Column | Type | Notes |
|---|---|---|
| ingredient_name | text | Canonical name, unique. Matching key. |
| category | text | e.g. "protein", "produce", "dairy", "pantry", "spice". |
| perishability | text | One of: `high`, `medium`, `low`. Orders **cook** days. |
| default_unit | text | Canonical unit for quantity math. |
| aliases | text | Comma-separated alternate names/abbreviations for normalization. |
| is_staple | boolean | If true, this ingredient appears on the staple tracker (salt, soy sauce, oil, etc.). |

### 7.4 `unit_conversions` (app table)

| Column | Type | Notes |
|---|---|---|
| from_unit | text | e.g. `lb`. |
| to_unit | text | e.g. `g`. |
| multiplier | number | `from_qty * multiplier = to_qty`. Only compatible pairs. |

Seed in code or a one-time migration, not from Sheets.

### 7.5 `receipts` (app table)

| Column | Type | Notes |
|---|---|---|
| receipt_id | text | Unique ID per scan or manual entry. |
| scan_date | date | Retention clock starts here. |
| source | text | `image`, `pdf`, or `manual`. |
| original_filename | text | Optional. |
| mime_type | text | e.g. `image/jpeg`, `application/pdf`. Null for manual. |
| storage_path | text | Supabase Storage object path. Null for manual, or after retention delete. |
| raw_ocr_text | text | Raw extract or typed list. Cleared when the file is deleted. |
| file_deleted_at | datetime | Set when the 14-day job removes the file. |

### 7.6 `receipt_items` (app table)

| Column | Type | Notes |
|---|---|---|
| receipt_id | text | Foreign key to `receipts.receipt_id`. |
| raw_line_text | text | Original line or typed fragment. |
| matched_ingredient_name | text | Canonical name after LLM + user confirm. |
| quantity | number | Parsed, guessed, or user-edited. |
| unit | text | As confirmed; converted at match time. |
| price | number | Optional. Stored for a future budget view. Unused in MVP UI. |
| confirmed_by_user | boolean | True after the final-check screen. |

### 7.7 `pantry_items` (app table)

Current kitchen state. Two shapes of row:

- **Leftovers from a plan / unused purchases:** quantity + unit, marked still-have or ran-out.
- **Staples:** one row per `ingredients.is_staple = true` (salt, soy sauce, etc.). Quantity optional; **in_stock / ran_out** is what feasibility uses.

| Column | Type | Notes |
|---|---|---|
| pantry_item_id | text | Unique ID. |
| ingredient_name | text | Foreign key to `ingredients.ingredient_name`. |
| quantity | number | Optional for staples. |
| unit | text | Should match or convert to `default_unit`. |
| status | text | `in_stock` (still have) or `ran_out`. |
| kind | text | `leftover` or `staple`. |
| updated_at | datetime | |

**MVP pantry UX:**
- After picking a plan (and again before the next scan), show unused / leftover purchased ingredients. Each row: **Still have** / **Ran out**. Only still-have carries into the next pool.
- Next scan confirm screen lists "already in kitchen" above new items; user can drop or edit qty.
- Staple tracker: a simple list of staple ingredients with in-stock / ran-out. Default in-stock. A receipt line that matches a staple can set it back to in-stock.
- Do **not** auto-decrement when meals are cooked.

### 7.8 `weekly_plan_generations` (app table)

One row per generate action (initial shop or mid-week rescan).

| Column | Type | Notes |
|---|---|---|
| generation_id | text | Unique ID. |
| start_date | date | Day 1 of this 7-day window (the day generation ran). |
| receipt_id | text | The receipt/manual entry that triggered this generation. Pantry is always merged in. |

### 7.9 `weekly_plans` (app table)

| Column | Type | Notes |
|---|---|---|
| plan_id | text | Unique ID. |
| generation_id | text | Foreign key to `weekly_plan_generations.generation_id`. |
| plan_rank | number | 1, 2, 3 among candidates in this generation. |
| overlap_score | number | Computed. |
| grocery_utilization_pct | number | Share of purchased ingredients used. |
| summary_text | text | Short theme description. |
| selected | boolean | Whether this is the user's active plan. At most one selected plan at a time. |

### 7.10 `weekly_plan_slots` (app table)

Replaces a one-recipe-per-day model.

| Column | Type | Notes |
|---|---|---|
| plan_id | text | Foreign key to `weekly_plans.plan_id`. |
| day_number | number | 1 through 7. Day 1 = generation `start_date`. |
| meal_slot | text | `lunch` or `dinner`. |
| recipe_id | text | Foreign key to `recipes.recipe_id`. Null if the user cleared the slot. |
| is_leftover | boolean | True when this slot is a suggested next-day leftover of the previous cook of the same recipe. User edits may leave this stale; treat as a badge, not a hard constraint. |

Unique on `(plan_id, day_number, meal_slot)`.

## 8. App / UI (PWA, mobile-first)

The primary client is a **phone PWA** (home-screen install, Safari / Chrome on iOS). Desktop must work and stay useful, but layouts are designed for a one-handed phone first and scale up.

**Visual reference:** copy `docs/ui-reference/meal-plan-mobile-reference.png`. The **right screen (Meal Plan)** is the source of truth for This week. The left screen (recipe grid) is only a style cousin for any future recipe-browse UI — not an MVP screen. Do not add breakfast, likes, or bookmarks.

### 8.1 Principles

- **Mobile-first, responsive.** Default breakpoint is a ~390px phone. Desktop is the same visual language with more columns, not a different product.
- **Thumb zone.** Primary actions (add groceries, push back a day, confirm) sit in easy reach. Tap targets at least 44px.
- **Online for capture and generation.** Scanning, PDF parse, and plan generation need the network. The active week should still be readable if the connection drops; full offline planning is out of scope.
- **Installable.** Web app manifest + service worker for install and to cache the shell and the last active plan.
- **Safe areas.** Respect iOS notch / home indicator. File pickers must accept camera, photo library, and Files (PDF).

### 8.2 Navigation

Three tabs, bottom on phone, top or side on desktop:

| Tab | Role |
|---|---|
| **This week** | Active 14-slot plan. Home. Matches the reference Meal Plan screen. |
| **Add groceries** | Camera, library, PDF, or type a list. Mid-week top-up lives here too. |
| **Kitchen** | Leftover still-have / ran-out checklist and staple tracker. |

Plan switching (other candidates from this generation) is a control on **This week**, not its own tab.

### 8.3 Screens

**This week (home) — follow the right reference screen.**

- Large bold title: **Meal Plan**.
- Horizontal **day strip** for the 7-day window (not a calendar month). Each cell is weekday abbreviation + date number. Selected day is a filled dark-teal circle with white type; other days are muted gray. Day 1 is generation `start_date` (today when the plan was made).
- Below the strip: spelled-out date on the left (e.g. `Wednesday, 12 Aug`). On the right, a **circular coral/red +** button. In this app that opens Add groceries (or a short sheet: add groceries vs switch candidate plan), not a free-form “add any recipe” catalog.
- Body is **one selected day at a time**, not all 14 slots in one scroll. Two section headers only, all-caps muted gray: **LUNCH** then **DINNER**. No breakfast.
- Each meal is a horizontal row: rounded square thumbnail (recipe photo if we have one later; otherwise a simple food-category placeholder), bold recipe name, gray subline for **leftover vs cook** and **1 serving** (1 serving = 1 meal). Pencil on the right opens meal detail (push back a day, remove, move slot).
- A day may show **one row per slot**. If the user has not removed anything, that is one lunch and one dinner. Empty slot: a quiet dashed row, “nothing planned.”
- Leftover suggestion: same row treatment, subline `Leftover · 1 serving` instead of a separate badge system.

**Meal detail (sheet on phone, side panel on desktop).** Instructions if present, ingredients for this cook (swaps and missing optionals called out), leftover vs cook, actions: push back a day, remove, move to another slot. Triggered by the pencil.

**Add groceries.** Four equal choices, same circular/pill language as the reference: take photo, choose photo, choose PDF, type a list. Short copy that iPhone document scans (PDF) work. After pick, a processing state, then the confirm screen.

**Confirm / final check.** Same white cards on the light canvas. “Already in kitchen” block on top (editable qty, dismiss). New lines below as meal-row-like lists: name, qty, unit, optional price. Add / delete line. Primary action is a full-width dark-teal button: generate plans.

**Pick a plan.** Three candidates, visually like stacked Meal Plan previews (theme summary + utilization, then a compact lunch/dinner list for day 1 as a teaser). **Phone:** swipe or vertical stack. **Desktop:** three columns of those same cards.

**Kitchen.** Same section-header + row pattern: leftover / unused purchases (Still have / Ran out), then staples (in stock / ran out).

**Empty / first-run.** Meal Plan chrome (title + day strip) with an empty day and one teal CTA to add groceries. Note that recipes come from CSV import.

### 8.4 Desktop — same Meal Plan, use the width

Do not invent a dashboard. Stretch the **right-hand reference**:

- Keep title, day strip, spelled-out date, and coral + in the same hierarchy.
- **Day strip can show all 7 days without horizontal scroll.**
- Main canvas: **7 day columns** (or a 7-column CSS grid). Each column is one day from the reference: date label on top, then LUNCH and DINNER stacks of the same thumbnail rows. Selected day can be a slightly stronger column (teal date circle + light teal/white column background).
- Clicking a row still opens meal detail in a **right-hand panel** (same content as the mobile sheet) so the week stays visible.
- Pick-a-plan: three Meal Plan cards in a row, each a mini version of the 7-column week or a single-day preview plus summary.
- Confirm and Kitchen: centered column ~560–640px on the same gray-blue canvas; no need to go full bleed.
- No hover-only actions. Pencil, +, and row actions stay clickable.

### 8.5 Visual system (from the reference)

| Token | Use |
|---|---|
| Canvas | Cool light gray-blue, not pure white page. |
| Cards / rows | White, large corner radius (~16–24px). |
| Primary fill | Dark teal (Filter/Sorting buttons, selected day circle, primary CTAs). |
| Accent | Coral/red circles for search-like and + actions. |
| Title | Large, bold, near-black sans. |
| Section labels | Small, bold, uppercase, muted gray (LUNCH / DINNER). |
| Secondary type | Medium gray (servings, leftover). |
| Images | Rounded squares; meal rows use a small thumb, not a full-bleed hero. |

Pill buttons (teal) for secondary actions (filter-style, “switch plan”). Circular coral for the one obvious add action. Generous padding; airy, not dense-admin.

## 9. Side feature: in-app recipe addition page (not MVP)

A simple form-based page to add new recipes in the PWA instead of editing the Google Sheet and re-exporting CSV.

- Form fields: recipe name, servings, prep time, cuisine tag, instructions/notes, and a repeatable ingredient row (autocomplete against `ingredients`, quantity, unit, tier, optional `substitute_for`).
- On submit, writes `recipes` and `recipe_ingredients` in the app database.
- If the ingredient does not exist, offer to create it (category, perishability, default unit, staple flag).
- Build this after the core MVP flow (capture through multi-plan generation and schedule editing) works end to end.

## 10. Suggested tech stack

- **Framework:** Next.js (PWA-enabled), matches existing familiarity from prior projects. Mobile-first CSS; installable manifest.
- **Backend/storage:** Supabase (Postgres) for app tables. **Supabase Storage** bucket `receipts` for images and PDFs (private). CSV import seeds `recipes`, `recipe_ingredients`, and `ingredients` from the Google Sheets export. App-generated data stays in Postgres; receipt **files** live in Storage and are deleted after 14 days (Section 6.6).
- **Scheduled retention:** daily job (Supabase scheduled function or `pg_cron`) that deletes Storage objects and raw extracts older than 14 days.
- **Image / PDF text extraction:** A receipt-specific parsing API (e.g. Veryfi, Taggun, or Mindee) that accepts images and PDFs, or Google Cloud Vision / Document AI if a receipt-specific API isn't available.
- **Normalization / matching / summaries:** OpenAI API. Use GPT-5.4 Mini for receipt/manual-list normalization (fuzzy mapping of abbreviated text like "GV WHL MLK GAL" to a canonical ingredient). GPT-5.4 Nano is enough for short plan summaries. Deterministic work stays in application code: unit conversion, feasibility, plan-level quantity checks, clustering, perishability sequencing, prep-time-to-dinner, overlap scoring. Confirm current model names/pricing at platform.openai.com/docs/pricing before hardcoding a model string.

## 11. MVP scope summary

**In scope for MVP:**
- Mobile-first PWA UI (This week, Add groceries, Kitchen), responsive desktop including 3-column plan compare.
- Receipt **image** and **PDF** upload (iPhone document scans included) **and** simple manual ingredient entry (LLM-assisted guesses).
- Store files in Supabase Storage; **auto-delete file + raw extract after 14 days**; keep confirmed line items.
- Normalization, unit conversion, and a final-check confirm screen (add / edit / delete lines).
- Merge with pantry; staple in-stock / ran-out tracking.
- Feasibility matching with optional-as-modified, substitute auto-swap (prefer on-hand staple), and **plan-level** quantity constraints.
- Three candidate plans: 7 days from today, lunch + dinner (14 slots), ~5–8 cooks with next-day leftover suggestions, repeat cooks if the week would otherwise be short.
- Side-by-side review, select active plan, switch candidates later.
- Active-plan screen with reorder, remove, and push-back-a-day.
- Mid-week second trip: merge pantry + new items, regenerate a new 7-day window from that day.
- Still have / ran out leftover checklist; "already in kitchen" on the next confirm screen.
- Store line-item **price** (no budget UI yet).
- CSV import for recipes/ingredients from Google Sheets.

**Deferred (post-MVP):**
- In-app recipe addition page (Section 9).
- Budget / spend view using stored prices.
- Nutrition, live grocery pricing, multi-user.
- Auto-decrement pantry when a meal is marked cooked.
- Full offline plan generation.
