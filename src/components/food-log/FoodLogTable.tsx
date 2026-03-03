"use client";

import { Trash2, Bot, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FoodLogEntry, DailyMacroTotals } from "@/types";

interface Props {
  entries: FoodLogEntry[];
  onDelete: (id: number) => void;
}

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"] as const;

const MEAL_COLORS: Record<string, string> = {
  breakfast: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  lunch: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  dinner: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  snack: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

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

export function FoodLogTable({ entries, onDelete }: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-center text-muted-foreground text-sm py-8">
        Nothing logged yet — add your first meal above.
      </p>
    );
  }

  const totals = sumMacros(entries);

  const grouped = MEAL_ORDER.map((meal) => ({
    meal,
    items: entries.filter((e) => e.meal_type === meal),
  })).filter((g) => g.items.length > 0);

  const ungrouped = entries.filter(
    (e) => !MEAL_ORDER.includes(e.meal_type as "breakfast" | "lunch" | "dinner" | "snack")
  );

  const allGroups = [
    ...grouped,
    ...(ungrouped.length > 0 ? [{ meal: "other" as const, items: ungrouped }] : []),
  ];

  return (
    <div className="space-y-4">
      {allGroups.map(({ meal, items }) => (
        <div key={meal}>
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full ${MEAL_COLORS[meal] ?? ""}`}
            >
              {meal.charAt(0).toUpperCase() + meal.slice(1)}
            </span>
            <span className="text-xs text-muted-foreground">
              {sumMacros(items).calories.toFixed(0)} kcal
            </span>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[480px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Food</TableHead>
                  <TableHead className="text-right">Cal</TableHead>
                  <TableHead className="text-right">Protein</TableHead>
                  <TableHead className="text-right">Carbs</TableHead>
                  <TableHead className="text-right">Fat</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {entry.source === "ai_chat" && (
                          <Bot className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                        )}
                        {entry.source === "recipe" && (
                          <ChefHat className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                        <span className="font-medium text-sm">{entry.food_name}</span>
                        {entry.serving_size && (
                          <span className="text-xs text-muted-foreground">
                            ({entry.serving_size})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {Number(entry.calories).toFixed(0)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {Number(entry.protein_g).toFixed(1)}g
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {Number(entry.carbs_g).toFixed(1)}g
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {Number(entry.fat_g).toFixed(1)}g
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      <div className="rounded-md border bg-muted/50 px-4 py-3">
        <div className="flex justify-between items-center">
          <span className="font-semibold">Daily Totals</span>
          <div className="flex gap-4 text-sm font-mono">
            <span className="text-orange-600 font-bold">{totals.calories.toFixed(0)} kcal</span>
            <span className="text-blue-600">P: {totals.protein_g.toFixed(1)}g</span>
            <span className="text-yellow-600">C: {totals.carbs_g.toFixed(1)}g</span>
            <span className="text-red-600">F: {totals.fat_g.toFixed(1)}g</span>
          </div>
        </div>
      </div>
    </div>
  );
}
