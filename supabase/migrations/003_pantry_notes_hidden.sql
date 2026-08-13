alter table pantry_items
  add column if not exists notes text not null default '';

alter table pantry_items
  add column if not exists hidden boolean not null default false;
