"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { DailyMacroTotals } from "@/types";

interface Props {
  totals: DailyMacroTotals;
}

export function MacroDonutChart({ totals }: Props) {
  const raw = [
    { name: "Protein", value: Math.round(totals.protein_g * 4), fill: "#3b82f6" },
    { name: "Carbs", value: Math.round(totals.carbs_g * 4), fill: "#f59e0b" },
    { name: "Fat", value: Math.round(totals.fat_g * 9), fill: "#ef4444" },
  ].filter((d) => d.value > 0);
  const totalKcal = raw.reduce((sum, d) => sum + d.value, 0);
  const data = raw.map((d) => ({
    ...d,
    percent: totalKcal > 0 ? Math.round((d.value / totalKcal) * 100) : 0,
  }));

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
        No food logged today
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={75}
          paddingAngle={3}
          dataKey="value"
          label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v, _name, item) => {
            const pct = (item?.payload as { percent?: number } | undefined)?.percent ?? 0;
            return [`${v} kcal (${pct}%)`];
          }}
          wrapperStyle={{ zIndex: 50 }}
          contentStyle={{ borderRadius: "8px", fontSize: "12px", backgroundColor: "#ffffff", borderColor: "#e5e7eb", color: "#111827" }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "12px" }}
          formatter={(value, _entry, index) => `${value} ${data[index]?.percent ?? 0}%`}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
