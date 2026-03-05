"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FoodEntryForm } from "@/components/food-log/FoodEntryForm";
import { FoodLogTable } from "@/components/food-log/FoodLogTable";
import { MacroProgressBars } from "@/components/food-log/MacroProgressBars";
import { QuickLogBar } from "@/components/food-log/QuickLogBar";
import { Skeleton } from "@/components/ui/skeleton";
import { FoodLogEntry, DailyMacroTotals } from "@/types";
import { shareOrCopy } from "@/lib/shareUtils";
import { localDateStr } from "@/lib/utils";

const GOALS = { calories: 2100, protein_g: 180, carbs_g: 170, fat_g: 75, fiber_g: 30 };

const MEAL_EMOJI: Record<string, string> = {
  breakfast: "🍳",
  lunch: "🥗",
  dinner: "🍽️",
  snack: "🍎",
};

function toDateStr(d: Date) {
  return localDateStr(d);
}

function shiftDate(d: Date, days: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}

function sumMacros(entries: FoodLogEntry[]): DailyMacroTotals {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + Number(e.calories),
      protein_g: acc.protein_g + Number(e.protein_g),
      carbs_g: acc.carbs_g + Number(e.carbs_g),
      fat_g: acc.fat_g + Number(e.fat_g),
      fiber_g: acc.fiber_g + Number(e.fiber_g),
      sodium_mg: acc.sodium_mg + Number(e.sodium_mg),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0 }
  );
}

function getEntryTimestamp(entry: FoodLogEntry): number {
  const createdMs = new Date(entry.created_at).getTime();
  if (!Number.isNaN(createdMs)) return createdMs;
  const fallbackMs = new Date(`${entry.logged_at}T12:00:00`).getTime();
  return Number.isNaN(fallbackMs) ? 0 : fallbackMs;
}

function buildShareText(entries: FoodLogEntry[], date: Date): string {
  const dateLabel = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const lines: string[] = [`📊 Food Log — ${dateLabel}`, ""];

  const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"] as const;
  for (const meal of MEAL_ORDER) {
    const items = entries.filter((e) => e.meal_type === meal);
    if (items.length === 0) continue;
    lines.push(`${MEAL_EMOJI[meal] ?? "•"} ${meal.charAt(0).toUpperCase() + meal.slice(1)}`);
    for (const e of items) {
      const serving = e.serving_size ? ` (${e.serving_size})` : "";
      lines.push(
        `• ${e.food_name}${serving} — ${Number(e.calories).toFixed(0)} cal | ${Number(e.protein_g).toFixed(1)}g P | ${Number(e.carbs_g).toFixed(1)}g C | ${Number(e.fat_g).toFixed(1)}g F`
      );
    }
    lines.push("");
  }

  const totals = sumMacros(entries);
  lines.push("📈 Daily Totals");
  lines.push(
    `Calories: ${totals.calories.toFixed(0)} / ${GOALS.calories} | Protein: ${totals.protein_g.toFixed(1)}g / ${GOALS.protein_g}g | Carbs: ${totals.carbs_g.toFixed(1)}g / ${GOALS.carbs_g}g | Fat: ${totals.fat_g.toFixed(1)}g / ${GOALS.fat_g}g | Fiber: ${totals.fiber_g.toFixed(1)}g / ${GOALS.fiber_g}g`
  );

  return lines.join("\n");
}

function targetMealForHour(hour: number): "breakfast" | "lunch" | "dinner" | "snack" {
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

function isHealthyForMeal(entry: FoodLogEntry, meal: "breakfast" | "lunch" | "dinner" | "snack"): boolean {
  const calories = Number(entry.calories);
  const protein = Number(entry.protein_g);
  const sodium = Number(entry.sodium_mg);

  if (meal === "snack") {
    return calories >= 100 && calories <= 350 && protein >= 8 && sodium <= 450;
  }
  return calories >= 250 && calories <= 750 && protein >= 20 && sodium <= 900;
}

function buildMealRecommendation(todayEntries: FoodLogEntry[], recentEntries: FoodLogEntry[]): string {
  const now = new Date();
  const targetMeal = targetMealForHour(now.getHours());
  const mealOrder: Array<"breakfast" | "lunch" | "dinner" | "snack"> = [
    "breakfast",
    "lunch",
    "dinner",
    "snack",
  ];
  const targetIdx = mealOrder.indexOf(targetMeal);

  // If target meal is already logged today, advance to next likely meal slot.
  const todayMeals = new Set(todayEntries.map((e) => e.meal_type).filter(Boolean));
  let nextMeal = targetMeal;
  if (todayMeals.has(targetMeal)) {
    const fallback = mealOrder.slice(targetIdx + 1).find((m) => !todayMeals.has(m));
    if (fallback) nextMeal = fallback;
  }

  const cutoffMs = now.getTime() - 72 * 60 * 60 * 1000;
  const recent72 = recentEntries
    .filter((e) => getEntryTimestamp(e) >= cutoffMs)
    .sort((a, b) => getEntryTimestamp(b) - getEntryTimestamp(a));

  const todayTotals = sumMacros(todayEntries);
  const proteinLeft = Math.max(0, GOALS.protein_g - todayTotals.protein_g);
  const fiberLeft = Math.max(0, GOALS.fiber_g - todayTotals.fiber_g);
  const caloriesLeft = Math.max(0, GOALS.calories - todayTotals.calories);

  const candidates = recent72.filter(
    (e) => (e.meal_type === nextMeal || e.meal_type === "snack") && isHealthyForMeal(e, nextMeal)
  );

  const scored = candidates
    .map((e) => {
      const protein = Number(e.protein_g);
      const fiber = Number(e.fiber_g);
      const calories = Number(e.calories);
      const sodium = Number(e.sodium_mg);
      const proteinScore = proteinLeft > 30 ? protein * 2 : protein;
      const fiberScore = fiberLeft > 10 ? fiber * 1.5 : fiber;
      const caloriePenalty = calories > caloriesLeft && caloriesLeft > 0 ? 20 : 0;
      const sodiumPenalty = sodium > 1000 ? 8 : 0;
      const totalScore = proteinScore + fiberScore - caloriePenalty - sodiumPenalty;
      return { entry: e, totalScore };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  const best = scored[0]?.entry;
  const displayMeal = nextMeal.charAt(0).toUpperCase() + nextMeal.slice(1);

  if (best) {
    const macroHint =
      proteinLeft > 25
        ? "You're still protein-light today, so that repeat helps."
        : fiberLeft > 8
          ? "You still need some fiber today, and that choice keeps things balanced."
          : "It fits your current day totals well.";
    return `What's next for ${displayMeal.toLowerCase()}? If you have any ${best.food_name.toLowerCase()} left from recent meals, go for that. ${macroHint}`;
  }

  if (nextMeal === "breakfast") {
    return "It's almost breakfast. Keep it simple: eggs or yogurt, then add fruit if fiber is low.";
  }
  if (nextMeal === "lunch") {
    return "What's for lunch? Center it on lean protein and a fiber carb to steady afternoon hunger.";
  }
  if (nextMeal === "dinner") {
    return "Dinner target: protein + vegetables, and keep sodium controlled for a cleaner next weigh-in.";
  }
  return "Snack window: choose something protein-forward and moderate in calories to stay aligned with today's goals.";
}

export default function FoodLogPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [recentEntries, setRecentEntries] = useState<FoodLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [shareLabel, setShareLabel] = useState<"share" | "done">("share");

  const today = new Date();
  const isToday = toDateStr(selectedDate) === toDateStr(today);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const [dayRes, recentRes] = await Promise.all([
        fetch(`/api/food-log?date=${toDateStr(selectedDate)}`),
        fetch("/api/food-log?weeks=6"),
      ]);
      const [dayData, recentData] = await Promise.all([dayRes.json(), recentRes.json()]);
      setEntries(Array.isArray(dayData) ? dayData : []);
      setRecentEntries(Array.isArray(recentData) ? recentData : []);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  function handleAdded(entry: FoodLogEntry) {
    setEntries((prev) => [...prev, entry]);
    setRecentEntries((prev) => [entry, ...prev]);
    setOpen(false);
  }

  async function handleDelete(id: number) {
    await fetch(`/api/food-log/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setRecentEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function handleUpdated(updated: FoodLogEntry) {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setRecentEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  async function handleShare() {
    const text = buildShareText(entries, selectedDate);
    await shareOrCopy(text, "Food Log");
    setShareLabel("done");
    setTimeout(() => setShareLabel("share"), 2000);
  }

  const totals = sumMacros(entries);
  const mealRecommendation = buildMealRecommendation(entries, recentEntries);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Food Log</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track your daily calories and macros.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>+ Add Food</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Log Food</DialogTitle>
            </DialogHeader>
            <FoodEntryForm date={toDateStr(selectedDate)} onAdded={handleAdded} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Log */}
      <QuickLogBar date={toDateStr(selectedDate)} onAdded={handleAdded} />

      {/* Date Navigator */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center min-w-44">
          <p className="font-semibold">
            {isToday
              ? "Today"
              : selectedDate.toLocaleDateString("en-US", { weekday: "long" })}
          </p>
          <p className="text-sm text-muted-foreground">
            {selectedDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
          disabled={isToday}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Next Meal Idea</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">{mealRecommendation}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Daily Goals</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <MacroProgressBars totals={totals} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Meals</CardTitle>
              {!loading && entries.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleShare} className="h-8 gap-1.5">
                  {shareLabel === "done" ? (
                    <><Check className="h-3.5 w-3.5 text-green-600" /> Shared!</>
                  ) : (
                    <><Share2 className="h-3.5 w-3.5" /> Share Day</>
                  )}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <FoodLogTable
                  entries={entries}
                  onDelete={handleDelete}
                  onUpdated={handleUpdated}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
