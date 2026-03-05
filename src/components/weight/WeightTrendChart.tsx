"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { WeightEntry } from "@/types";

interface Props {
  entries: WeightEntry[];
  goalWeight?: number;
}

export function WeightTrendChart({ entries, goalWeight }: Props) {
  const data = [...entries]
    .filter((e) => Number.isFinite(Number(e.weight_lbs)))
    .sort((a, b) => {
      const dateCmp = a.logged_at.localeCompare(b.logged_at);
      if (dateCmp !== 0) return dateCmp;
      const rank = (v: WeightEntry["time_of_day"]) =>
        v === "morning" ? 0 : v === "evening" ? 1 : 2;
      return rank(a.time_of_day) - rank(b.time_of_day);
    })
    .map((e) => {
      const dateOnly = String(e.logged_at).slice(0, 10);
      const parsed = new Date(`${dateOnly}T12:00:00`);
      const label = Number.isNaN(parsed.getTime())
        ? dateOnly
        : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const slot = e.time_of_day === "morning" ? "AM" : e.time_of_day === "evening" ? "PM" : "";
      return {
        date: slot ? `${label} ${slot}` : label,
        weight: Number(e.weight_lbs),
      };
    });

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
        No data yet — log your first weight entry above.
      </div>
    );
  }

  const weights = data.map((d) => d.weight);
  const minY = Math.floor(Math.min(...weights) - 3);
  const maxY = Math.ceil(Math.max(...weights) + 3);

  return (
    <ResponsiveContainer width="100%" height={280} style={{ overflow: "visible" }}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[minY, maxY]}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}`}
          width={45}
        />
        <Tooltip
          formatter={(value) => [`${value} lbs`, "Weight"]}
          wrapperStyle={{ zIndex: 50 }}
          contentStyle={{
            borderRadius: "8px",
            fontSize: "13px",
            backgroundColor: "hsl(var(--popover))",
            borderColor: "hsl(var(--border))",
            color: "hsl(var(--popover-foreground))",
          }}
        />
        {goalWeight && (
          <ReferenceLine
            y={goalWeight}
            stroke="#22c55e"
            strokeDasharray="5 5"
            label={{ value: "Goal", position: "right", fontSize: 11, fill: "#22c55e" }}
          />
        )}
        <Line
          type="monotone"
          dataKey="weight"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
