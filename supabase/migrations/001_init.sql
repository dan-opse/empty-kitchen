-- Meal Prep Planner schema (PRD §7) plus snapshot/swap columns needed for plan edits.

create table if not exists ingredients (
  ingredient_name text primary key,
  category text not null,
  perishability text not null check (perishability in ('high', 'medium', 'low')),
  default_unit text not null,
  aliases text not null default '',
  is_staple boolean not null default false
);

create table if not exists recipes (
  recipe_id text primary key,
  recipe_name text not null,
  servings numeric not null default 1,
  prep_time_minutes numeric not null default 0,
  cuisine_tag text,
  instructions text,
  notes text
);

create table if not exists recipe_ingredients (
  id bigint generated always as identity primary key,
  recipe_id text not null references recipes (recipe_id) on delete cascade,
  ingredient_name text not null references ingredients (ingredient_name),
  quantity numeric not null,
  unit text not null,
  tier text not null check (tier in ('staple', 'required', 'optional')),
  substitute_for text
);

create table if not exists unit_conversions (
  from_unit text not null,
  to_unit text not null,
  multiplier numeric not null,
  primary key (from_unit, to_unit)
);

create table if not exists receipts (
  receipt_id text primary key,
  scan_date date not null,
  source text not null check (source in ('image', 'pdf', 'manual')),
  original_filename text,
  mime_type text,
  storage_path text,
  raw_ocr_text text,
  file_deleted_at timestamptz
);

create table if not exists receipt_items (
  receipt_item_id bigint generated always as identity primary key,
  receipt_id text not null references receipts (receipt_id) on delete cascade,
  raw_line_text text not null,
  matched_ingredient_name text,
  quantity numeric,
  unit text,
  price numeric,
  confirmed_by_user boolean not null default false
);

create table if not exists pantry_items (
  pantry_item_id text primary key,
  ingredient_name text not null references ingredients (ingredient_name),
  quantity numeric,
  unit text,
  status text not null check (status in ('in_stock', 'ran_out')),
  kind text not null check (kind in ('leftover', 'staple')),
  updated_at timestamptz not null default now()
);

create table if not exists weekly_plan_generations (
  generation_id text primary key,
  start_date date not null,
  receipt_id text not null references receipts (receipt_id)
);

create table if not exists weekly_plans (
  plan_id text primary key,
  generation_id text not null references weekly_plan_generations (generation_id) on delete cascade,
  plan_rank integer not null,
  overlap_score numeric not null default 0,
  grocery_utilization_pct numeric not null default 0,
  summary_text text not null default '',
  selected boolean not null default false,
  slots_snapshot jsonb,
  usage jsonb not null default '[]'::jsonb
);

create unique index if not exists weekly_plans_one_selected
  on weekly_plans (selected)
  where selected = true;

create table if not exists weekly_plan_slots (
  plan_id text not null references weekly_plans (plan_id) on delete cascade,
  day_number integer not null check (day_number between 1 and 7),
  meal_slot text not null check (meal_slot in ('lunch', 'dinner')),
  recipe_id text references recipes (recipe_id),
  is_leftover boolean not null default false,
  modified boolean not null default false,
  swaps jsonb not null default '[]'::jsonb,
  missing_optionals jsonb not null default '[]'::jsonb,
  primary key (plan_id, day_number, meal_slot)
);

insert into unit_conversions (from_unit, to_unit, multiplier) values
  ('kg', 'g', 1000),
  ('g', 'kg', 0.001),
  ('lb', 'g', 453.592),
  ('g', 'lb', 0.00220462),
  ('oz', 'g', 28.3495),
  ('g', 'oz', 0.035274),
  ('lb', 'oz', 16),
  ('oz', 'lb', 0.0625),
  ('kg', 'lb', 2.20462),
  ('lb', 'kg', 0.453592),
  ('l', 'ml', 1000),
  ('ml', 'l', 0.001),
  ('cup', 'ml', 236.588),
  ('ml', 'cup', 0.00422675),
  ('tbsp', 'ml', 14.7868),
  ('ml', 'tbsp', 0.067628),
  ('tsp', 'ml', 4.92892),
  ('ml', 'tsp', 0.202884),
  ('gal', 'ml', 3785.41),
  ('ml', 'gal', 0.000264172),
  ('fl oz', 'ml', 29.5735),
  ('ml', 'fl oz', 0.033814),
  ('cup', 'tbsp', 16),
  ('tbsp', 'cup', 0.0625),
  ('tbsp', 'tsp', 3),
  ('tsp', 'tbsp', 0.333333),
  ('l', 'cup', 4.22675),
  ('cup', 'l', 0.236588)
on conflict (from_unit, to_unit) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do nothing;

alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table unit_conversions enable row level security;
alter table receipts enable row level security;
alter table receipt_items enable row level security;
alter table pantry_items enable row level security;
alter table weekly_plan_generations enable row level security;
alter table weekly_plans enable row level security;
alter table weekly_plan_slots enable row level security;
