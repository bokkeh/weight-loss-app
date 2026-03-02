"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { WeightEntry } from "@/types";

interface Props {
  entries: WeightEntry[];
}

export function WeeklyWeightChart({ entries }: Props) {
  const data = [...entries]
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    .map((e) => ({
      date: new Date(e.logged_at + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      weight: Number(e.weight_lbs),
    }));

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
        No weight data this week
      </div>
    );
  }

  const weights = data.map((d) => d.weight);
  const minY = Math.floor(Math.min(...weights) - 2);
  const maxY = Math.ceil(Math.max(...weights) + 2);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis domain={[minY, maxY]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
        <Tooltip formatter={(v) => [`${v} lbs`, "Weight"]} contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
        <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
