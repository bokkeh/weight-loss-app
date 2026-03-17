"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WeeklyWeightChart } from "@/components/dashboard/WeeklyWeightChart";
import { WeeklyCaloriesChart } from "@/components/dashboard/WeeklyCaloriesChart";
import { MacroDonutChart } from "@/components/dashboard/MacroDonutChart";
import { DailyQuote } from "@/components/dashboard/DailyQuote";
import { WaterWidget } from "@/components/dashboard/WaterWidget";
import { WeightEntry, FoodLogEntry, DailyMacroTotals } from "@/types";
import {
  Scale,
  Flame,
  Beef,
  TrendingDown,
  Sparkles,
  Loader2,
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudRain,
  CloudSnow,
  CloudLightning,
} from "lucide-react";
import { localDateStr } from "@/lib/utils";
import { DEFAULT_MACRO_GOALS, goalsFromProfile } from "@/lib/goals";

const GUT_TIP_VARIANTS: string[][] = [
  [
    "Don't overload protein shakes trying to max out protein in one hit. Too much at once can upset your gut.",
    "If your stomach feels off, split protein across meals instead of mega-dosing one shake.",
    "Hydrate consistently while increasing protein.",
  ],
  [
    "If you had diarrhea today, keep tomorrow simple with binding foods like toast or rice.",
    "Once your gut settles, ramp protein back up gradually instead of forcing heavy meals immediately.",
    "Add extra water and electrolytes to recover.",
  ],
  [
    "High protein works best when your gut can tolerate it. Bigger isn't always better in one serving.",
    "Use easy foods first after a rough digestion day, then return to your usual protein targets.",
    "Water intake is part of digestion support, not just hydration.",
  ],
];

function sumMacros(entries: FoodLogEntry[]): DailyMacroTotals {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + Number(e.calories),
      protein_g: acc.protein_g + Number(e.protein_g),
      carbs_g: acc.carbs_g + Number(e.carbs_g),
      fat_g: acc.fat_g + Number(e.fat_g),
      fiber_g: acc.fiber_g + Number(e.fiber_g),
      sugar_g: acc.sugar_g + Number(e.sugar_g ?? 0),
      sodium_mg: acc.sodium_mg + Number(e.sodium_mg),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 }
  );
}

function getWeekKey() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week}`;
}

function greetingByHour(hour: number): "Good morning" | "Good afternoon" | "Good evening" {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function weatherMeta(code: number): { label: string; Icon: React.ComponentType<{ className?: string }> } {
  if (code === 0) return { label: "Clear", Icon: Sun };
  if ([1, 2].includes(code)) return { label: "Partly Cloudy", Icon: CloudSun };
  if (code === 3) return { label: "Cloudy", Icon: Cloud };
  if ([45, 48].includes(code)) return { label: "Foggy", Icon: CloudFog };
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { label: "Rainy", Icon: CloudRain };
  if ([71, 73, 75, 85, 86].includes(code)) return { label: "Snowy", Icon: CloudSnow };
  if ([95, 96, 99].includes(code)) return { label: "Stormy", Icon: CloudLightning };
  return { label: "Mild", Icon: CloudSun };
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  valueColor?: string;
}

function StatCard({ title, value, subtitle, icon, color, valueColor }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${valueColor ?? ""}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function FirstMealWidgetPlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-dashed flex items-center justify-center text-center ${compact ? "min-h-28 p-3" : "h-48 px-4"}`}>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">To see this widget, log your first meal.</p>
        <Button asChild size="sm" variant="outline">
          <Link href="/food-log">Log Meal</Link>
        </Button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [foodEntries, setFoodEntries] = useState<FoodLogEntry[]>([]);
  const [todayFood, setTodayFood] = useState<FoodLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<number | null>(null);
  const [weeklyAvgCalories, setWeeklyAvgCalories] = useState<number | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [calorieGoal, setCalorieGoal] = useState(2100);
  const [macroGoals, setMacroGoals] = useState(DEFAULT_MACRO_GOALS);
  const [gutTipIndex, setGutTipIndex] = useState(0);
  const [firstName, setFirstName] = useState("there");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [weather, setWeather] = useState<{ tempF: number; code: number } | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState({
    height_in: "",
    current_weight_lbs: "",
    goal_weight_lbs: "",
    dietary_restrictions: "",
    calorie_goal: String(DEFAULT_MACRO_GOALS.calories),
    protein_goal_g: String(DEFAULT_MACRO_GOALS.protein_g),
    carbs_goal_g: String(DEFAULT_MACRO_GOALS.carbs_g),
    fat_goal_g: String(DEFAULT_MACRO_GOALS.fat_g),
    fiber_goal_g: String(DEFAULT_MACRO_GOALS.fiber_g),
    sugar_goal_g: String(DEFAULT_MACRO_GOALS.sugar_g),
    sodium_goal_mg: String(DEFAULT_MACRO_GOALS.sodium_mg),
  });

  useEffect(() => {
    const saved = localStorage.getItem("calorieGoal");
    if (saved) setCalorieGoal(parseFloat(saved));
    const weekKey = getWeekKey();
    const cached = localStorage.getItem(`weeklySummary_${weekKey}`);
    if (cached) setSummary(cached);
    const tipKey = "dashboard_gut_tip_index";
    const prevTip = Number(localStorage.getItem(tipKey) ?? "-1");
    const nextTip = Number.isFinite(prevTip)
      ? (prevTip + 1) % GUT_TIP_VARIANTS.length
      : 0;
    setGutTipIndex(nextTip);
    localStorage.setItem(tipKey, String(nextTip));
    const storedName = localStorage.getItem("firstName") ?? localStorage.getItem("userName");
    if (storedName?.trim()) {
      setFirstName(storedName.trim().split(" ")[0]);
    }

    async function load() {
      const today = localDateStr();
      const [w, f, t, s, p] = await Promise.all([
        fetch("/api/weight?weeks=4").then((r) => r.json()),
        fetch("/api/food-log?weeks=1").then((r) => r.json()),
        fetch(`/api/food-log?date=${today}`).then((r) => r.json()),
        fetch(`/api/stats?today=${today}`).then((r) => r.json()),
        fetch("/api/profile").then((r) => r.json()).catch(() => null),
      ]);
      setWeightEntries(Array.isArray(w) ? w : []);
      setFoodEntries(Array.isArray(f) ? f : []);
      setTodayFood(Array.isArray(t) ? t : []);
      if (p?.first_name) {
        setFirstName(String(p.first_name).trim() || "there");
      }
      if (p?.profile_image_url) {
        setProfileImageUrl(String(p.profile_image_url));
      }
      if (p) {
        const goals = goalsFromProfile(p);
        setMacroGoals(goals);
        setCalorieGoal(goals.calories);
        setOnboardingForm((prev) => ({
          ...prev,
          calorie_goal: String(goals.calories),
          protein_goal_g: String(goals.protein_g),
          carbs_goal_g: String(goals.carbs_g),
          fat_goal_g: String(goals.fat_g),
          fiber_goal_g: String(goals.fiber_g),
          sugar_goal_g: String(goals.sugar_g),
          sodium_goal_mg: String(goals.sodium_mg),
          height_in: p.height_in != null ? String(p.height_in) : prev.height_in,
          goal_weight_lbs: p.goal_weight_lbs != null ? String(p.goal_weight_lbs) : prev.goal_weight_lbs,
          dietary_restrictions: Array.isArray(p.dietary_restrictions)
            ? p.dietary_restrictions.join(", ")
            : prev.dietary_restrictions,
        }));
        if (!p.onboarding_completed) {
          setOnboardingOpen(true);
        }
      }
      if (!s.error) {
        setStreak(s.streak ?? 0);
        setWeeklyAvgCalories(s.weeklyAvgCalories ?? null);
      }
      setLoading(false);
    }
    load();

    async function fetchWeather(lat: number, lon: number) {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`
      );
      if (!res.ok) return;
      const data = await res.json();
      const current = data?.current;
      if (typeof current?.temperature_2m === "number" && typeof current?.weather_code === "number") {
        setWeather({ tempF: current.temperature_2m, code: current.weather_code });
      }
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetchWeather(pos.coords.latitude, pos.coords.longitude).catch(() => undefined);
        },
        () => {
          fetchWeather(41.8781, -87.6298).catch(() => undefined);
        },
        { timeout: 5000 }
      );
    } else {
      fetchWeather(41.8781, -87.6298).catch(() => undefined);
    }
  }, []);

  function onboardingFieldChange<K extends keyof typeof onboardingForm>(key: K, value: string) {
    setOnboardingForm((prev) => ({ ...prev, [key]: value }));
  }

  function toNumberOrNull(value: string): number | null {
    if (!value.trim()) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  async function handleOnboardingSave() {
    setOnboardingSaving(true);
    try {
      const restrictions = onboardingForm.dietary_restrictions
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const profileRes = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dietary_restrictions: restrictions,
          calorie_goal: toNumberOrNull(onboardingForm.calorie_goal),
          protein_goal_g: toNumberOrNull(onboardingForm.protein_goal_g),
          carbs_goal_g: toNumberOrNull(onboardingForm.carbs_goal_g),
          fat_goal_g: toNumberOrNull(onboardingForm.fat_goal_g),
          fiber_goal_g: toNumberOrNull(onboardingForm.fiber_goal_g),
          sugar_goal_g: toNumberOrNull(onboardingForm.sugar_goal_g),
          sodium_goal_mg: toNumberOrNull(onboardingForm.sodium_goal_mg),
          height_in: toNumberOrNull(onboardingForm.height_in),
          goal_weight_lbs: toNumberOrNull(onboardingForm.goal_weight_lbs),
          onboarding_completed: true,
        }),
      });

      if (!profileRes.ok) {
        throw new Error("Failed to save onboarding profile.");
      }

      const currentWeight = toNumberOrNull(onboardingForm.current_weight_lbs);
      if (currentWeight && currentWeight > 0) {
        await fetch("/api/weight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            logged_at: localDateStr(),
            weight_lbs: currentWeight,
            time_of_day: "morning",
            note: "Initial onboarding entry",
          }),
        });
      }

      const cals = toNumberOrNull(onboardingForm.calorie_goal);
      if (cals && cals > 0) {
        setCalorieGoal(cals);
      }
      setMacroGoals({
        calories: toNumberOrNull(onboardingForm.calorie_goal) ?? DEFAULT_MACRO_GOALS.calories,
        protein_g: toNumberOrNull(onboardingForm.protein_goal_g) ?? DEFAULT_MACRO_GOALS.protein_g,
        carbs_g: toNumberOrNull(onboardingForm.carbs_goal_g) ?? DEFAULT_MACRO_GOALS.carbs_g,
        fat_g: toNumberOrNull(onboardingForm.fat_goal_g) ?? DEFAULT_MACRO_GOALS.fat_g,
        fiber_g: toNumberOrNull(onboardingForm.fiber_goal_g) ?? DEFAULT_MACRO_GOALS.fiber_g,
        sugar_g: toNumberOrNull(onboardingForm.sugar_goal_g) ?? DEFAULT_MACRO_GOALS.sugar_g,
        sodium_mg: toNumberOrNull(onboardingForm.sodium_goal_mg) ?? DEFAULT_MACRO_GOALS.sodium_mg,
      });
      setOnboardingOpen(false);
    } finally {
      setOnboardingSaving(false);
    }
  }

  async function handleGenerateSummary() {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/chat/weekly-summary");
      const data = await res.json();
      if (data.summary) {
        setSummary(data.summary);
        localStorage.setItem(`weeklySummary_${getWeekKey()}`, data.summary);
      }
    } finally {
      setSummaryLoading(false);
    }
  }

  const todayTotals = sumMacros(todayFood);
  const sortedWeight = [...weightEntries].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  const latestWeight = sortedWeight[0];
  const prevWeight = sortedWeight[1];
  const weightChange =
    latestWeight && prevWeight
      ? Number(latestWeight.weight_lbs) - Number(prevWeight.weight_lbs)
      : null;

  const weeklyWeightEntries = weightEntries.filter((e) => {
    const d = new Date(e.logged_at + "T12:00:00");
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  });

  const weeklyDeficit = weeklyAvgCalories !== null ? calorieGoal - weeklyAvgCalories : null;
  const greeting = `${greetingByHour(new Date().getHours())}, ${firstName}`;
  const weatherInfo = weather ? weatherMeta(weather.code) : null;
  const WeatherIcon = weatherInfo?.Icon;
  const hasAnyMealsLogged = foodEntries.length > 0 || todayFood.length > 0;

  return (
    <div className="space-y-6">
      <Dialog open={onboardingOpen} onOpenChange={() => undefined}>
        <DialogContent className="max-w-xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Welcome - set up your goals</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="onboard-height">Height (inches)</Label>
                <Input id="onboard-height" type="number" min={1} value={onboardingForm.height_in} onChange={(e) => onboardingFieldChange("height_in", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="onboard-current-weight">Current Weight (lbs)</Label>
                <Input id="onboard-current-weight" type="number" min={1} value={onboardingForm.current_weight_lbs} onChange={(e) => onboardingFieldChange("current_weight_lbs", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="onboard-goal-weight">Goal Weight (lbs)</Label>
                <Input id="onboard-goal-weight" type="number" min={1} value={onboardingForm.goal_weight_lbs} onChange={(e) => onboardingFieldChange("goal_weight_lbs", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="onboard-calories">Daily Calories</Label>
                <Input id="onboard-calories" type="number" min={1} value={onboardingForm.calorie_goal} onChange={(e) => onboardingFieldChange("calorie_goal", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="onboard-protein">Protein Goal (g)</Label>
                <Input id="onboard-protein" type="number" min={1} value={onboardingForm.protein_goal_g} onChange={(e) => onboardingFieldChange("protein_goal_g", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="onboard-carbs">Carbs Goal (g)</Label>
                <Input id="onboard-carbs" type="number" min={1} value={onboardingForm.carbs_goal_g} onChange={(e) => onboardingFieldChange("carbs_goal_g", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="onboard-fat">Fat Goal (g)</Label>
                <Input id="onboard-fat" type="number" min={1} value={onboardingForm.fat_goal_g} onChange={(e) => onboardingFieldChange("fat_goal_g", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="onboard-fiber">Fiber Goal (g)</Label>
                <Input id="onboard-fiber" type="number" min={1} value={onboardingForm.fiber_goal_g} onChange={(e) => onboardingFieldChange("fiber_goal_g", e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="onboard-sodium">Sodium Goal (mg)</Label>
                <Input id="onboard-sodium" type="number" min={1} value={onboardingForm.sodium_goal_mg} onChange={(e) => onboardingFieldChange("sodium_goal_mg", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="onboard-restrictions">Dietary Restrictions</Label>
              <Textarea
                id="onboard-restrictions"
                rows={3}
                placeholder="e.g. dairy-free, gluten-free"
                value={onboardingForm.dietary_restrictions}
                onChange={(e) => onboardingFieldChange("dietary_restrictions", e.target.value)}
              />
            </div>
            <Button type="button" onClick={handleOnboardingSave} disabled={onboardingSaving} className="w-full">
              {onboardingSaving ? "Saving..." : "Save and Continue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-16 h-16 rounded-full overflow-hidden border bg-muted shrink-0">
            {profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{greeting}</h1>
            <p className="text-muted-foreground text-sm mt-1">Your progress at a glance.</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {weatherInfo && weather && WeatherIcon && (
            <div className="text-right shrink-0 mt-1">
              <WeatherIcon className="h-10 w-10 ml-auto text-slate-700" />
              <p className="text-4xl font-semibold leading-tight mt-1">{Math.round(weather.tempF)}°F</p>
              <p className="text-sm text-muted-foreground">{weatherInfo.label}</p>
            </div>
          )}
        </div>
      </div>

      {/* Daily Quote */}
      <DailyQuote />

      {/* Main stat cards */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : !hasAnyMealsLogged ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <FirstMealWidgetPlaceholder compact />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Current Weight"
            value={latestWeight ? `${Number(latestWeight.weight_lbs).toFixed(1)} lbs` : "-"}
            subtitle={latestWeight
              ? new Date(latestWeight.logged_at + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "No entries yet"}
            icon={<Scale className="h-5 w-5 text-blue-600" />}
            color="bg-blue-50 dark:bg-blue-950"
          />
          <StatCard
            title="Since Last Log"
            value={weightChange !== null ? `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} lbs` : "-"}
            subtitle={weightChange !== null
              ? weightChange < 0 ? "Keep it up!" : weightChange > 0 ? "Slight increase" : "No change"
              : "Log more entries"}
            icon={<TrendingDown className="h-5 w-5 text-green-600" />}
            color="bg-green-50 dark:bg-green-950"
          />
          <StatCard
            title="Today's Calories"
            value={`${todayTotals.calories.toFixed(0)} kcal`}
            subtitle={`Goal: ${calorieGoal.toLocaleString()} kcal`}
            icon={<Flame className="h-5 w-5 text-orange-600" />}
            color="bg-orange-50 dark:bg-orange-950"
          />
          <StatCard
            title="Today's Protein"
            value={`${todayTotals.protein_g.toFixed(0)}g`}
            subtitle={`Goal: ${macroGoals.protein_g.toFixed(0)}g`}
            icon={<Beef className="h-5 w-5 text-purple-600" />}
            color="bg-purple-50 dark:bg-purple-950"
          />
        </div>
      )}

      {/* Streak + Deficit */}
      {!loading && (
        <div className="grid sm:grid-cols-2 gap-4">
          <StatCard
            title="Logging Streak"
            value={streak !== null ? `${streak} day${streak !== 1 ? "s" : ""}` : "-"}
            subtitle={streak ? (streak >= 7 ? "Amazing consistency!" : "Keep going!") : "Log today to start"}
            icon={<Flame className="h-5 w-5 text-amber-500" />}
            color="bg-amber-50 dark:bg-amber-950"
          />
          <StatCard
            title="Weekly Avg Deficit"
            value={weeklyDeficit !== null
              ? `${weeklyDeficit >= 0 ? "-" : "+"}${Math.abs(weeklyDeficit).toFixed(0)} kcal/day`
              : "-"}
            subtitle={weeklyAvgCalories !== null
              ? `Avg ${weeklyAvgCalories.toFixed(0)} kcal/day vs ${calorieGoal} goal`
              : "No food logged this week"}
            icon={<TrendingDown className={`h-5 w-5 ${weeklyDeficit !== null && weeklyDeficit >= 0 ? "text-green-600" : "text-red-500"}`} />}
            color={weeklyDeficit !== null && weeklyDeficit >= 0 ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}
            valueColor={weeklyDeficit !== null && weeklyDeficit >= 0 ? "text-green-600" : weeklyDeficit !== null ? "text-red-500" : ""}
          />
        </div>
      )}

      {/* Water Widget */}
      {!loading && (
        <WaterWidget
          sodiumMgToday={todayTotals.sodium_mg}
          hasFoodLogged={todayFood.length > 0}
        />
      )}

      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gut-Friendly Reminders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {GUT_TIP_VARIANTS[gutTipIndex].map((tip) => (
              <p key={tip}>{tip}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weight - Last 4 Weeks</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : hasAnyMealsLogged ? (
              <WeeklyWeightChart entries={weeklyWeightEntries} />
            ) : (
              <FirstMealWidgetPlaceholder />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calories - Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : hasAnyMealsLogged ? (
              <WeeklyCaloriesChart entries={foodEntries} calorieGoal={calorieGoal} />
            ) : (
              <FirstMealWidgetPlaceholder />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s Macro Split</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : hasAnyMealsLogged ? (
            <MacroDonutChart totals={todayTotals} />
          ) : (
            <FirstMealWidgetPlaceholder />
          )}
        </CardContent>
      </Card>

      {/* Weekly AI Summary */}
      <div className="p-[1.5px] rounded-xl bg-gradient-to-r from-violet-400 to-fuchsia-500 shadow-[0_0_18px_rgba(167,139,250,0.45)]">
        <Card className="rounded-[10px] border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <CardTitle className="text-base">Weekly Coach Summary</CardTitle>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateSummary}
              disabled={summaryLoading}
              className="gap-1.5"
            >
              {summaryLoading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Sparkles className="h-3.5 w-3.5 text-violet-400" />}
              {summary ? "Refresh" : "Generate"}
            </Button>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            ) : summary ? (
              <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Click &ldquo;Generate&rdquo; for a personalized AI recap of your week.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

