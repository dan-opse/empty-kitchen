-- On-demand plan generation: allow generations without a receipt, and store a per-plan grocery list.

alter table weekly_plan_generations
  alter column receipt_id drop not null;

alter table weekly_plans
  add column if not exists grocery_list jsonb not null default '[]'::jsonb;
