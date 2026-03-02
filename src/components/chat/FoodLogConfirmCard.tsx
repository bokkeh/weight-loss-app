import { CheckCircle } from "lucide-react";
import { FoodLogEntry } from "@/types";

interface Props {
  entry: FoodLogEntry;
}

export function FoodLogConfirmCard({ entry }: Props) {
  return (
    <div className="mt-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 p-3">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <span className="text-sm font-semibold text-green-800 dark:text-green-200">
          Logged to Food Diary
        </span>
      </div>
      <p className="text-sm font-medium">{entry.food_name}</p>
      {entry.serving_size && (
        <p className="text-xs text-muted-foreground">{entry.serving_size}</p>
      )}
      <div className="flex gap-3 mt-1.5 text-xs font-mono">
        <span className="text-orange-600">{Number(entry.calories).toFixed(0)} kcal</span>
        <span className="text-blue-600">P: {Number(entry.protein_g).toFixed(1)}g</span>
        <span className="text-yellow-600">C: {Number(entry.carbs_g).toFixed(1)}g</span>
        <span className="text-red-600">F: {Number(entry.fat_g).toFixed(1)}g</span>
      </div>
    </div>
  );
}
