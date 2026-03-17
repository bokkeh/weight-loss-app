export interface MacroGoals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
}

export const DEFAULT_MACRO_GOALS: MacroGoals = {
  calories: 2100,
  protein_g: 180,
  carbs_g: 170,
  fat_g: 75,
  fiber_g: 30,
  sugar_g: 50, // WHO guideline: <10% of 2100 kcal = ~52g; 50g is a practical weight-loss target
  sodium_mg: 2300,
};

function positiveOrFallback(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

export function goalsFromProfile(profile: unknown): MacroGoals {
  const p = (profile ?? {}) as Record<string, unknown>;
  return {
    calories: positiveOrFallback(p.calorie_goal, DEFAULT_MACRO_GOALS.calories),
    protein_g: positiveOrFallback(p.protein_goal_g, DEFAULT_MACRO_GOALS.protein_g),
    carbs_g: positiveOrFallback(p.carbs_goal_g, DEFAULT_MACRO_GOALS.carbs_g),
    fat_g: positiveOrFallback(p.fat_goal_g, DEFAULT_MACRO_GOALS.fat_g),
    fiber_g: positiveOrFallback(p.fiber_goal_g, DEFAULT_MACRO_GOALS.fiber_g),
    sugar_g: positiveOrFallback(p.sugar_goal_g, DEFAULT_MACRO_GOALS.sugar_g),
    sodium_mg: positiveOrFallback(p.sodium_goal_mg, DEFAULT_MACRO_GOALS.sodium_mg),
  };
}
