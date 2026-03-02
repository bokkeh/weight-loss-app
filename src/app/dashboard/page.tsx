"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WeeklyWeightChart } from "@/components/dashboard/WeeklyWeightChart";
import { WeeklyCaloriesChart } from "@/components/dashboard/WeeklyCaloriesChart";
import { MacroDonutChart } from "@/components/dashboard/MacroDonutChart";
import { WeightEntry, FoodLogEntry, DailyMacroTotals } from "@/types";
import { Scale, Flame, Beef, TrendingDown } from "lucide-react";

function sumMacros(entries: FoodLogEntry[]): DailyMacroTotals {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + Number(e.calories),
      protein_g: acc.protein_g + Number(e.protein_g),
      carbs_g: acc.carbs_g + Number(e.carbs_g),
      fat_g: acc.fat_g + Number(e.fat_g),
      fiber_g: acc.fiber_g + Number(e.fiber_g),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, subtitle, icon, color }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
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

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split("T")[0];
      const [w, f, t] = await Promise.all([
        fetch("/api/weight?weeks=4").then((r) => r.json()),
        fetch("/api/food-log?weeks=1").then((r) => r.json()),
        fetch(`/api/food-log?date=${today}`).then((r) => r.json()),
      ]);
      setWeightEntries(w);
      setFoodEntries(f);
      setTodayFood(t);
      setLoading(false);
    }
    load();
  }, []);

  const todayTotals = sumMacros(todayFood);

  const sortedWeight = [...weightEntries].sort((a, b) =>
    b.logged_at.localeCompare(a.logged_at)
  );
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your progress at a glance.
        </p>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Current Weight"
            value={
              latestWeight ? `${Number(latestWeight.weight_lbs).toFixed(1)} lbs` : "—"
            }
            subtitle={
              latestWeight
                ? new Date(latestWeight.logged_at + "T12:00:00").toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric" }
                  )
                : "No entries yet"
            }
            icon={<Scale className="h-5 w-5 text-blue-600" />}
            color="bg-blue-50 dark:bg-blue-950"
          />
          <StatCard
            title="Since Last Log"
            value={
              weightChange !== null
                ? `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} lbs`
                : "—"
            }
            subtitle={
              weightChange !== null
                ? weightChange < 0
                  ? "Keep it up!"
                  : weightChange > 0
                  ? "Slight increase"
                  : "No change"
                : "Log more entries"
            }
            icon={<TrendingDown className="h-5 w-5 text-green-600" />}
            color="bg-green-50 dark:bg-green-950"
          />
          <StatCard
            title="Today's Calories"
            value={`${todayTotals.calories.toFixed(0)} kcal`}
            subtitle="Goal: 2,000 kcal"
            icon={<Flame className="h-5 w-5 text-orange-600" />}
            color="bg-orange-50 dark:bg-orange-950"
          />
          <StatCard
            title="Today's Protein"
            value={`${todayTotals.protein_g.toFixed(0)}g`}
            subtitle="Goal: 150g"
            icon={<Beef className="h-5 w-5 text-purple-600" />}
            color="bg-purple-50 dark:bg-purple-950"
          />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weight — Last 4 Weeks</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <WeeklyWeightChart entries={weeklyWeightEntries} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calories — Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <WeeklyCaloriesChart entries={foodEntries} />
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
          ) : (
            <MacroDonutChart totals={todayTotals} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
