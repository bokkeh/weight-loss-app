"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { FoodLogEntry } from "@/types";

interface Props {
  entries: FoodLogEntry[];
  calorieGoal?: number;
}

export function WeeklyCaloriesChart({ entries, calorieGoal = 2000 }: Props) {
  // Group by date and sum calories
  const byDate: Record<string, number> = {};
  entries.forEach((e) => {
    byDate[e.logged_at] = (byDate[e.logged_at] ?? 0) + Number(e.calories);
  });

  // Build last 7 days
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    data.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      calories: byDate[dateStr] ?? 0,
    });
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
        <Tooltip formatter={(v) => [`${v} kcal`, "Calories"]} contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
        <ReferenceLine y={calorieGoal} stroke="#f59e0b" strokeDasharray="4 4" />
        <Bar dataKey="calories" fill="#f97316" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
