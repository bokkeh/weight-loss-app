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
