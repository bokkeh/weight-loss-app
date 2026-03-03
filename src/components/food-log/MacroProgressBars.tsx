"use client";

import { Progress } from "@/components/ui/progress";
import { DailyMacroTotals } from "@/types";

const GOALS = {
  calories: 2000,
  protein_g: 150,
  carbs_g: 200,
  fat_g: 65,
  fiber_g: 30,
  sodium_mg: 2300,
};

interface Props {
  totals: DailyMacroTotals;
}

function MacroRow({
  label,
  value,
  goal,
  unit,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  unit: string;
  color: string;
}) {
  const pct = Math.min((value / goal) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {value.toFixed(0)}<span className="text-muted-foreground/60">/{goal}{unit}</span>
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function MacroProgressBars({ totals }: Props) {
  return (
    <div className="space-y-3">
      <MacroRow
        label="Calories"
        value={totals.calories}
        goal={GOALS.calories}
        unit="kcal"
        color="bg-orange-500"
      />
      <MacroRow
        label="Protein"
        value={totals.protein_g}
        goal={GOALS.protein_g}
        unit="g"
        color="bg-blue-500"
      />
      <MacroRow
        label="Carbs"
        value={totals.carbs_g}
        goal={GOALS.carbs_g}
        unit="g"
        color="bg-yellow-500"
      />
      <MacroRow
        label="Fat"
        value={totals.fat_g}
        goal={GOALS.fat_g}
        unit="g"
        color="bg-red-500"
      />
      <MacroRow
        label="Fiber"
        value={totals.fiber_g}
        goal={GOALS.fiber_g}
        unit="g"
        color="bg-green-500"
      />
      <MacroRow
        label="Sodium"
        value={totals.sodium_mg}
        goal={GOALS.sodium_mg}
        unit="mg"
        color="bg-cyan-500"
      />
    </div>
  );
}
