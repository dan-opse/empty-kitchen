"use server";

import { revalidatePath } from "next/cache";
import {
  deleteActivePlan,
  deleteAllSavedPlans,
  deselectActivePlan,
  getMealDetail,
  moveSlot,
  persistGeneration,
  pushBackDay,
  removeSlot,
  selectPlan,
} from "@/lib/plans";
import type { GenerateMode, MealSlot } from "@/lib/types";

export async function choosePlan(planId: string) {
  try {
    await selectPlan(planId);
    revalidatePath("/");
    revalidatePath("/plans");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not select plan" };
  }
}

export async function clearMeal(planId: string, day: number, meal: MealSlot) {
  try {
    await removeSlot(planId, day, meal);
    revalidatePath("/");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not remove meal" };
  }
}

export async function shiftMealBack(planId: string, day: number, meal: MealSlot) {
  try {
    await pushBackDay(planId, day, meal);
    revalidatePath("/");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not push meal back" };
  }
}

export async function fetchMealDetail(planId: string, day: number, meal: MealSlot) {
  try {
    const detail = await getMealDetail(planId, day, meal);
    return { ok: true as const, detail };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not load meal" };
  }
}

export async function relocateMeal(
  planId: string,
  fromDay: number,
  fromMeal: MealSlot,
  toDay: number,
  toMeal: MealSlot,
) {
  try {
    await moveSlot(planId, fromDay, fromMeal, toDay, toMeal);
    revalidatePath("/");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not move meal" };
  }
}

export async function generatePlansOnDemand(input: { days: number; mode: GenerateMode }) {
  try {
    const { generationId, planCount } = await persistGeneration({
      receiptId: null,
      purchased: [],
      days: input.days,
      mode: input.mode,
    });
    if (planCount === 0) {
      return {
        ok: false as const,
        error: "No plans could be generated. Try the grocery-list mode to plan meals with items to buy.",
      };
    }
    revalidatePath("/");
    revalidatePath("/plans");
    return { ok: true as const, generationId };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not generate plans" };
  }
}

export async function clearWeek() {
  try {
    await deselectActivePlan();
    revalidatePath("/");
    revalidatePath("/plans");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not clear the week" };
  }
}

export async function removeCurrentPlan() {
  try {
    const deleted = await deleteActivePlan();
    revalidatePath("/");
    revalidatePath("/plans");
    return { ok: true as const, deleted };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not delete the plan" };
  }
}

export async function removeAllSavedPlans() {
  try {
    await deleteAllSavedPlans();
    revalidatePath("/");
    revalidatePath("/plans");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not delete saved plans" };
  }
}
