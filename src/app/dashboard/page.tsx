"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WeeklyWeightChart } from "@/components/dashboard/WeeklyWeightChart";
import { WeeklyCaloriesChart } from "@/components/dashboard/WeeklyCaloriesChart";
import { MacroDonutChart } from "@/components/dashboard/MacroDonutChart";
import { DailyQuote } from "@/components/dashboard/DailyQuote";
import { WaterWidget } from "@/components/dashboard/WaterWidget";
import { WeightEntry, FoodLogEntry, DailyMacroTotals } from "@/types";
import { Scale, Flame, Beef, TrendingDown, Sparkles, Download, Loader2, Share2, Check } from "lucide-react";
import { shareOrCopy } from "@/lib/shareUtils";
import { localDateStr } from "@/lib/utils";

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
      sodium_mg: acc.sodium_mg + Number(e.sodium_mg),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0 }
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

function weatherMeta(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: "Clear", emoji: "☀️" };
  if ([1, 2].includes(code)) return { label: "Partly Cloudy", emoji: "⛅" };
  if (code === 3) return { label: "Cloudy", emoji: "☁️" };
  if ([45, 48].includes(code)) return { label: "Foggy", emoji: "🌫️" };
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { label: "Rainy", emoji: "🌧️" };
  if ([71, 73, 75, 85, 86].includes(code)) return { label: "Snowy", emoji: "❄️" };
  if ([95, 96, 99].includes(code)) return { label: "Stormy", emoji: "⛈️" };
  return { label: "Mild", emoji: "🌤️" };
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
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
  const [shareLabel, setShareLabel] = useState<"share" | "done">("share");
  const [gutTipIndex, setGutTipIndex] = useState(0);
  const [firstName, setFirstName] = useState("there");
  const [weather, setWeather] = useState<{ tempF: number; code: number } | null>(null);

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

  async function handleExportCSV() {
    const [allWeight, allFood] = await Promise.all([
      fetch("/api/weight?weeks=520").then((r) => r.json()),
      fetch("/api/food-log?weeks=520").then((r) => r.json()),
    ]);
    downloadCSV("weight-log.csv", [
      ["Date", "Weight (lbs)", "Note"],
      ...(allWeight as WeightEntry[]).map((e) => [e.logged_at, String(e.weight_lbs), e.note ?? ""]),
    ]);
    downloadCSV("food-log.csv", [
      ["Date", "Food", "Meal", "Calories", "Protein(g)", "Carbs(g)", "Fat(g)", "Fiber(g)", "Serving"],
      ...(allFood as FoodLogEntry[]).map((e) => [
        e.logged_at, e.food_name, e.meal_type ?? "",
        String(e.calories), String(e.protein_g), String(e.carbs_g), String(e.fat_g), String(e.fiber_g),
        e.serving_size ?? "",
      ]),
    ]);
  }

  async function handleShare() {
    const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const latestW = sortedWeight[0];
    const lines: string[] = [`💪 Health Dashboard — ${dateLabel}`, ""];

    if (latestW) {
      const wChange = weightChange !== null
        ? ` (${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} lbs since last log)`
        : "";
      lines.push(`⚖️ Weight: ${Number(latestW.weight_lbs).toFixed(1)} lbs${wChange}`);
    }
    if (streak !== null) {
      lines.push(`🔥 Streak: ${streak} day${streak !== 1 ? "s" : ""}`);
    }
    lines.push("");

    const tod = sumMacros(todayFood);
    lines.push("Today's Nutrition");
    lines.push(`• Calories: ${tod.calories.toFixed(0)} / ${calorieGoal} kcal`);
    lines.push(`• Protein: ${tod.protein_g.toFixed(1)}g / 180g  |  Carbs: ${tod.carbs_g.toFixed(1)}g / 170g  |  Fat: ${tod.fat_g.toFixed(1)}g / 75g`);

    if (weeklyAvgCalories !== null) {
      lines.push("");
      lines.push("This Week");
      lines.push(`• Avg Calories: ${weeklyAvgCalories.toFixed(0)} kcal/day`);
      const def = calorieGoal - weeklyAvgCalories;
      lines.push(`• vs Goal: ${def >= 0 ? `${def.toFixed(0)} kcal under` : `${Math.abs(def).toFixed(0)} kcal over`}`);
    }

    await shareOrCopy(lines.join("\n"), "Health Dashboard");
    setShareLabel("done");
    setTimeout(() => setShareLabel("share"), 2000);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{greeting}</h1>
          <p className="text-muted-foreground text-sm mt-1">Your progress at a glance.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {weatherInfo && weather && (
            <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5 bg-card">
              <span className="text-xl leading-none">{weatherInfo.emoji}</span>
              <div className="leading-tight">
                <p className="text-sm font-semibold">{Math.round(weather.tempF)}°F</p>
                <p className="text-[11px] text-muted-foreground">{weatherInfo.label}</p>
              </div>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5 shrink-0">
            {shareLabel === "done" ? (
              <><Check className="h-3.5 w-3.5 text-green-600" /> Shared!</>
            ) : (
              <><Share2 className="h-3.5 w-3.5" /> Share</>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 shrink-0">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Daily Quote */}
      <DailyQuote />

      {/* Main stat cards */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Current Weight"
            value={latestWeight ? `${Number(latestWeight.weight_lbs).toFixed(1)} lbs` : "—"}
            subtitle={latestWeight
              ? new Date(latestWeight.logged_at + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "No entries yet"}
            icon={<Scale className="h-5 w-5 text-blue-600" />}
            color="bg-blue-50 dark:bg-blue-950"
          />
          <StatCard
            title="Since Last Log"
            value={weightChange !== null ? `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} lbs` : "—"}
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
            subtitle="Goal: 180g"
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
            value={streak !== null ? `${streak} day${streak !== 1 ? "s" : ""}` : "—"}
            subtitle={streak ? (streak >= 7 ? "Amazing consistency! 🔥" : "Keep going!") : "Log today to start"}
            icon={<Flame className="h-5 w-5 text-amber-500" />}
            color="bg-amber-50 dark:bg-amber-950"
          />
          <StatCard
            title="Weekly Avg Deficit"
            value={weeklyDeficit !== null
              ? `${weeklyDeficit >= 0 ? "-" : "+"}${Math.abs(weeklyDeficit).toFixed(0)} kcal/day`
              : "—"}
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
            <CardTitle className="text-base">Weight — Last 4 Weeks</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full" /> : <WeeklyWeightChart entries={weeklyWeightEntries} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calories — Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full" /> : <WeeklyCaloriesChart entries={foodEntries} />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s Macro Split</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-48 w-full" /> : <MacroDonutChart totals={todayTotals} />}
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
