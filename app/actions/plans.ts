"use server";

import { revalidatePath } from "next/cache";
import { getMealDetail, moveSlot, pushBackDay, removeSlot, selectPlan } from "@/lib/plans";
import type { MealSlot } from "@/lib/types";

export async function choosePlan(planId: string) {
  try {
    await selectPlan(planId);
    revalidatePath("/");
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
