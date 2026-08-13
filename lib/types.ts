export type Perishability = "high" | "medium" | "low";
export type IngredientTier = "staple" | "required" | "optional";
export type MealSlot = "lunch" | "dinner";
export type PantryStatus = "in_stock" | "ran_out";
export type PantryKind = "leftover" | "staple";
export type ReceiptSource = "image" | "pdf" | "manual";

export type Ingredient = {
  ingredient_name: string;
  category: string;
  perishability: Perishability;
  default_unit: string;
  aliases: string;
  is_staple: boolean;
};

export type Recipe = {
  recipe_id: string;
  recipe_name: string;
  servings: number;
  prep_time_minutes: number;
  cuisine_tag: string | null;
  instructions: string | null;
  notes: string | null;
};

export type RecipeIngredient = {
  recipe_id: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
  tier: IngredientTier;
  substitute_for: string | null;
};

export type UnitConversion = {
  from_unit: string;
  to_unit: string;
  multiplier: number;
};

export type PantryItem = {
  pantry_item_id: string;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
  status: PantryStatus;
  kind: PantryKind;
  notes: string;
  hidden: boolean;
  updated_at: string;
};

export type Receipt = {
  receipt_id: string;
  scan_date: string;
  source: ReceiptSource;
  original_filename: string | null;
  mime_type: string | null;
  storage_path: string | null;
  raw_ocr_text: string | null;
  file_deleted_at: string | null;
};

export type ReceiptItem = {
  receipt_id: string;
  raw_line_text: string;
  matched_ingredient_name: string | null;
  quantity: number | null;
  unit: string | null;
  price: number | null;
  confirmed_by_user: boolean;
};

export type PoolItem = {
  ingredient_name: string;
  quantity: number;
  unit: string;
  source: "pantry" | "receipt" | "staple";
};

export type PurchasedItem = {
  ingredient_name: string;
  quantity: number;
  unit: string;
};

export type DraftLine = {
  raw_line_text: string;
  matched_ingredient_name: string;
  quantity: number | null;
  unit: string;
  price: number | null;
  needs_review: boolean;
};

export type PlanSlot = {
  day_number: number;
  meal_slot: MealSlot;
  recipe_id: string | null;
  recipe_name: string | null;
  prep_time_minutes: number | null;
  cuisine_tag: string | null;
  is_leftover: boolean;
  modified: boolean;
  swaps: { from: string; to: string }[];
  missing_optionals: string[];
};

export type GeneratedPlan = {
  plan_rank: number;
  overlap_score: number;
  grocery_utilization_pct: number;
  summary_text: string;
  days: number;
  slots: PlanSlot[];
  usage: PlanUsageRow[];
  grocery_list: GroceryListRow[];
};

export type PlanUsageRow = {
  ingredient_name: string;
  used_qty: number;
  leftover_qty: number;
  unit: string;
};

export type GroceryListRow = {
  ingredient_name: string;
  quantity: number;
  unit: string;
};

export type GenerateMode = "use-kitchen" | "grocery-list";

export type QtyMap = Map<string, { qty: number; unit: string }>;

export type ActiveWeek = {
  plan_id: string;
  generation_id: string;
  start_date: string;
  summary_text: string;
  grocery_utilization_pct: number;
  plan_rank: number;
  days: number;
  slots: PlanSlot[];
  candidates: PlanCandidate[];
  grocery_list: GroceryListRow[];
};

export type PlanCandidate = {
  plan_id: string;
  plan_rank: number;
  summary_text: string;
  grocery_utilization_pct: number;
  selected: boolean;
  days: number;
  slots: PlanSlot[];
  grocery_list: GroceryListRow[];
};

export type PlanHistoryPlan = {
  plan_id: string;
  plan_rank: number;
  summary_text: string;
  grocery_utilization_pct: number;
  selected: boolean;
  days: number;
};

export type PlanHistoryGeneration = {
  generation_id: string;
  start_date: string;
  plans: PlanHistoryPlan[];
};

export type MealDetail = {
  slot: PlanSlot;
  instructions: string | null;
  notes: string | null;
  ingredients: {
    name: string;
    quantity: number;
    unit: string;
    tier: IngredientTier;
    swappedFrom?: string;
    missing?: boolean;
  }[];
};

export const ACTIVE_PLAN_CACHE_KEY = "meal-prep:active-plan";
