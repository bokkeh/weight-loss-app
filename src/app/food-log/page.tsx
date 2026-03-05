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

const GOALS = { calories: 2100, protein_g: 180, carbs_g: 170, fat_g: 75, fiber_g: 30, sodium_mg: 2300 };

const MEAL_EMOJI: Record<string, string> = {
  breakfast: "ðŸ³",
  lunch: "ðŸ¥—",
  dinner: "ðŸ½ï¸",
  snack: "ðŸŽ",
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
  const lines: string[] = [`ðŸ“Š Food Log â€” ${dateLabel}`, ""];

  const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"] as const;
  for (const meal of MEAL_ORDER) {
    const items = entries.filter((e) => e.meal_type === meal);
    if (items.length === 0) continue;
    lines.push(`${MEAL_EMOJI[meal] ?? "â€¢"} ${meal.charAt(0).toUpperCase() + meal.slice(1)}`);
    for (const e of items) {
      const serving = e.serving_size ? ` (${e.serving_size})` : "";
      lines.push(
        `â€¢ ${e.food_name}${serving} â€” ${Number(e.calories).toFixed(0)} cal | ${Number(e.protein_g).toFixed(1)}g P | ${Number(e.carbs_g).toFixed(1)}g C | ${Number(e.fat_g).toFixed(1)}g F`
      );
    }
    lines.push("");
  }

  const totals = sumMacros(entries);
  lines.push("ðŸ“ˆ Daily Totals");
  lines.push(
    `Calories: ${totals.calories.toFixed(0)} / ${GOALS.calories} | Protein: ${totals.protein_g.toFixed(1)}g / ${GOALS.protein_g}g | Carbs: ${totals.carbs_g.toFixed(1)}g / ${GOALS.carbs_g}g | Fat: ${totals.fat_g.toFixed(1)}g / ${GOALS.fat_g}g | Fiber: ${totals.fiber_g.toFixed(1)}g / ${GOALS.fiber_g}g | Sodium: ${totals.sodium_mg.toFixed(0)}mg / ${GOALS.sodium_mg}mg`
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

function buildMealIdeas(todayEntries: FoodLogEntry[], recentEntries: FoodLogEntry[]): string[] {
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
  const second = scored[1]?.entry;
  const displayMeal = nextMeal.charAt(0).toUpperCase() + nextMeal.slice(1);
  const ideas: string[] = [];

  if (best) {
    const macroHint =
      proteinLeft > 25
        ? "You're still protein-light today, so that repeat helps."
        : fiberLeft > 8
          ? "You still need some fiber today, and that choice keeps things balanced."
          : "It fits your current day totals well.";
    ideas.push(
      `What's next for ${displayMeal.toLowerCase()}? If you have any ${best.food_name.toLowerCase()} left from recent meals, go for that. ${macroHint}`
    );
  }

  if (second && second.id !== best?.id) {
    ideas.push(
      `Alternate ${displayMeal.toLowerCase()} idea: reuse ${second.food_name.toLowerCase()} from your last 72 hours for a familiar, on-plan option.`
    );
  }

  if (targetMeal === "snack" || now.getHours() >= 21) {
    if (proteinLeft >= 20 && caloriesLeft >= 150) {
      ideas.push(
        "Late-night macro catch-up: a Greek yogurt + berries snack is a clean way to add protein without overshooting calories."
      );
    }
    if (proteinLeft >= 30 && caloriesLeft >= 250) {
      ideas.push(
        "Still low on protein after dinner? Try cottage cheese with fruit or a light turkey wrap to close the gap."
      );
    }
    if (caloriesLeft < 120) {
      ideas.push(
        "You're close to your calorie goal tonight. Keep snacks very light: fruit, a few carrots, or herbal tea."
      );
    }
  }

  if (nextMeal === "breakfast") {
    ideas.push("It's almost breakfast. Keep it simple: eggs or yogurt, then add fruit if fiber is low.");
  }
  if (nextMeal === "lunch" && ideas.length < 3) {
    ideas.push("What's for lunch? Center it on lean protein and a fiber carb to steady afternoon hunger.");
  }
  if (nextMeal === "dinner" && ideas.length < 3) {
    ideas.push("Dinner target: protein + vegetables, and keep sodium controlled for a cleaner next weigh-in.");
  }
  if (ideas.length === 0) {
    ideas.push("Snack window: choose something protein-forward and moderate in calories to stay aligned with today's goals.");
  }

  return ideas.slice(0, 5);
}

interface FrequentFood {
  key: string;
  food_name: string;
  serving_size: string | null;
  meal_type: FoodLogEntry["meal_type"];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  count: number;
  lastLoggedAt: string;
}

async function readJsonSafe<T>(res: Response): Promise<T | null> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function buildFrequentFoods(entries: FoodLogEntry[]): FrequentFood[] {
  const groups = new Map<string, FrequentFood>();
  for (const entry of entries) {
    const key = `${entry.food_name.trim().toLowerCase()}|${(entry.serving_size ?? "").trim().toLowerCase()}`;
    const existing = groups.get(key);
    const currentTs = getEntryTimestamp(entry);
    if (!existing) {
      groups.set(key, {
        key,
        food_name: entry.food_name,
        serving_size: entry.serving_size ?? null,
        meal_type: entry.meal_type ?? "snack",
        calories: Number(entry.calories),
        protein_g: Number(entry.protein_g),
        carbs_g: Number(entry.carbs_g),
        fat_g: Number(entry.fat_g),
        fiber_g: Number(entry.fiber_g),
        sodium_mg: Number(entry.sodium_mg),
        count: 1,
        lastLoggedAt: entry.created_at,
      });
      continue;
    }
    existing.count += 1;
    const existingTs = new Date(existing.lastLoggedAt).getTime();
    if (currentTs >= existingTs) {
      existing.meal_type = entry.meal_type ?? existing.meal_type;
      existing.calories = Number(entry.calories);
      existing.protein_g = Number(entry.protein_g);
      existing.carbs_g = Number(entry.carbs_g);
      existing.fat_g = Number(entry.fat_g);
      existing.fiber_g = Number(entry.fiber_g);
      existing.sodium_mg = Number(entry.sodium_mg);
      existing.lastLoggedAt = entry.created_at;
    }
  }
  return [...groups.values()]
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return new Date(b.lastLoggedAt).getTime() - new Date(a.lastLoggedAt).getTime();
    })
    .slice(0, 8);
}

async function buildGoalsSnapshotImage(totals: DailyMacroTotals, date: Date): Promise<File> {
  const width = 1080;
  const height = 1320;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create snapshot image.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#111827";
  ctx.font = "700 56px Arial";
  ctx.fillText("Daily Goals Snapshot", 70, 100);

  ctx.fillStyle = "#6b7280";
  ctx.font = "400 30px Arial";
  ctx.fillText(
    date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    70,
    145
  );

  const rows = [
    { label: "Calories", value: totals.calories, goal: GOALS.calories, unit: "kcal", color: "#f97316" },
    { label: "Protein", value: totals.protein_g, goal: GOALS.protein_g, unit: "g", color: "#3b82f6" },
    { label: "Carbs", value: totals.carbs_g, goal: GOALS.carbs_g, unit: "g", color: "#eab308" },
    { label: "Fat", value: totals.fat_g, goal: GOALS.fat_g, unit: "g", color: "#ef4444" },
    { label: "Fiber", value: totals.fiber_g, goal: GOALS.fiber_g, unit: "g", color: "#22c55e" },
    { label: "Sodium", value: totals.sodium_mg, goal: GOALS.sodium_mg, unit: "mg", color: "#06b6d4" },
  ];

  let y = 240;
  for (const row of rows) {
    const pct = Math.max(0, Math.min(1, row.value / row.goal));
    ctx.fillStyle = "#111827";
    ctx.font = "600 34px Arial";
    ctx.fillText(row.label, 70, y);

    ctx.fillStyle = "#4b5563";
    ctx.font = "500 30px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`${row.value.toFixed(0)} / ${row.goal}${row.unit}`, width - 70, y);
    ctx.textAlign = "left";

    const barX = 70;
    const barY = y + 22;
    const barW = width - 140;
    const barH = 26;

    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(barX, barY, barW, barH);

    ctx.fillStyle = row.color;
    ctx.fillRect(barX, barY, barW * pct, barH);
    y += 170;
  }

  ctx.fillStyle = "#9ca3af";
  ctx.font = "400 24px Arial";
  ctx.fillText("Generated by WeightTrack", 70, height - 60);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Failed to build goals snapshot.");
  return new File([blob], `daily-goals-${localDateStr(date)}.png`, { type: "image/png" });
}

export default function FoodLogPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [recentEntries, setRecentEntries] = useState<FoodLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [shareLabel, setShareLabel] = useState<"share" | "done">("share");
  const [goalsShareLabel, setGoalsShareLabel] = useState<"share" | "done">("share");
  const [mealIdeaIndex, setMealIdeaIndex] = useState(0);
  const [quickAddingKey, setQuickAddingKey] = useState<string | null>(null);

  const today = new Date();
  const isToday = toDateStr(selectedDate) === toDateStr(today);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const [dayRes, recentRes] = await Promise.all([
        fetch(`/api/food-log?date=${toDateStr(selectedDate)}`),
        fetch("/api/food-log?weeks=6"),
      ]);
      const [dayData, recentData] = await Promise.all([
        readJsonSafe<FoodLogEntry[] | { error?: string }>(dayRes),
        readJsonSafe<FoodLogEntry[] | { error?: string }>(recentRes),
      ]);

      setEntries(dayRes.ok && Array.isArray(dayData) ? dayData : []);
      setRecentEntries(recentRes.ok && Array.isArray(recentData) ? recentData : []);
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

  async function handleShareGoalsSnapshot() {
    const file = await buildGoalsSnapshotImage(totals, selectedDate);
    const nav = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
    };

    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({
        title: "Daily Goals Snapshot",
        text: "Today's macro goals snapshot",
        files: [file],
      });
      setGoalsShareLabel("done");
      setTimeout(() => setGoalsShareLabel("share"), 2000);
      return;
    }

    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    setGoalsShareLabel("done");
    setTimeout(() => setGoalsShareLabel("share"), 2000);
  }

  async function handleQuickAddFrequent(item: FrequentFood) {
    const todayStr = toDateStr(new Date());
    setQuickAddingKey(item.key);
    try {
      const res = await fetch("/api/food-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logged_at: todayStr,
          meal_type: item.meal_type ?? "snack",
          food_name: item.food_name,
          serving_size: item.serving_size ?? null,
          calories: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g,
          fiber_g: item.fiber_g,
          sodium_mg: item.sodium_mg,
          source: "manual",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const added = await readJsonSafe<FoodLogEntry>(res);
      if (!added) throw new Error("Failed to parse food log response.");
      setRecentEntries((prev) => [added, ...prev]);
      if (toDateStr(selectedDate) === todayStr) {
        setEntries((prev) => [...prev, added]);
      }
    } finally {
      setQuickAddingKey(null);
    }
  }

  const totals = sumMacros(entries);
  const mealIdeas = buildMealIdeas(entries, recentEntries);
  const currentMealIdea = mealIdeas[Math.min(mealIdeaIndex, Math.max(0, mealIdeas.length - 1))] ?? "";
  const frequentFoods = buildFrequentFoods(recentEntries);

  useEffect(() => {
    setMealIdeaIndex(0);
  }, [selectedDate, mealIdeas.length]);

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

      {!loading && frequentFoods.length > 0 && (
        <Card className="gap-2">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Frequently Logged</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {frequentFoods.map((item) => (
                <div key={item.key} className="shrink-0 rounded-lg border px-3 py-2 min-w-52 bg-background">
                  <p className="text-sm font-medium leading-snug truncate">{item.food_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.serving_size ? `${item.serving_size} - ` : ""}
                    {item.count}x logged
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.calories.toFixed(0)} cal - {item.protein_g.toFixed(0)}g P
                  </p>
                  <Button
                    size="sm"
                    className="mt-2 h-7 text-xs"
                    disabled={quickAddingKey === item.key}
                    onClick={() => handleQuickAddFrequent(item)}
                  >
                    {quickAddingKey === item.key ? "Adding..." : "Quick Add Today"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Next Meal Idea</CardTitle>
              {!loading && mealIdeas.length > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setMealIdeaIndex((prev) => (prev - 1 + mealIdeas.length) % mealIdeas.length)}
                    aria-label="Previous meal idea"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setMealIdeaIndex((prev) => (prev + 1) % mealIdeas.length)}
                    aria-label="Next meal idea"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground leading-relaxed">{currentMealIdea}</p>
                  {mealIdeas.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      Idea {Math.min(mealIdeaIndex + 1, mealIdeas.length)} of {mealIdeas.length}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Daily Goals</CardTitle>
              {!loading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShareGoalsSnapshot}
                  className="h-8 gap-1.5"
                >
                  {goalsShareLabel === "done" ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-600" />
                      Shared!
                    </>
                  ) : (
                    <>
                      <Share2 className="h-3.5 w-3.5" />
                      Share Goals
                    </>
                  )}
                </Button>
              )}
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


