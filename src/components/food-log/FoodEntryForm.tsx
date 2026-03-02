"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FoodLogEntry } from "@/types";

interface Props {
  date: string;
  onAdded: (entry: FoodLogEntry) => void;
}

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

const emptyForm = {
  food_name: "",
  serving_size: "",
  meal_type: "snack" as "breakfast" | "lunch" | "dinner" | "snack",
  calories: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
  fiber_g: "",
};

export function FoodEntryForm({ date, onAdded }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setField(key: keyof typeof emptyForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.food_name) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/food-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logged_at: date,
          ...form,
          calories: parseFloat(form.calories) || 0,
          protein_g: parseFloat(form.protein_g) || 0,
          carbs_g: parseFloat(form.carbs_g) || 0,
          fat_g: parseFloat(form.fat_g) || 0,
          fiber_g: parseFloat(form.fiber_g) || 0,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const entry: FoodLogEntry = await res.json();
      onAdded(entry);
      setForm(emptyForm);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <Label htmlFor="food-name">Food Name</Label>
          <Input
            id="food-name"
            placeholder="e.g. Grilled chicken breast"
            value={form.food_name}
            onChange={(e) => setField("food_name", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="serving">Serving Size</Label>
          <Input
            id="serving"
            placeholder="e.g. 4oz, 1 cup"
            value={form.serving_size}
            onChange={(e) => setField("serving_size", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="meal-type">Meal</Label>
          <Select
            value={form.meal_type}
            onValueChange={(v) => setField("meal_type", v)}
          >
            <SelectTrigger id="meal-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEAL_TYPES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="calories">Calories</Label>
          <Input
            id="calories"
            type="number"
            min="0"
            step="1"
            placeholder="kcal"
            value={form.calories}
            onChange={(e) => setField("calories", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="protein">Protein (g)</Label>
          <Input
            id="protein"
            type="number"
            min="0"
            step="0.1"
            placeholder="g"
            value={form.protein_g}
            onChange={(e) => setField("protein_g", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="carbs">Carbs (g)</Label>
          <Input
            id="carbs"
            type="number"
            min="0"
            step="0.1"
            placeholder="g"
            value={form.carbs_g}
            onChange={(e) => setField("carbs_g", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fat">Fat (g)</Label>
          <Input
            id="fat"
            type="number"
            min="0"
            step="0.1"
            placeholder="g"
            value={form.fat_g}
            onChange={(e) => setField("fat_g", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fiber">Fiber (g)</Label>
          <Input
            id="fiber"
            type="number"
            min="0"
            step="0.1"
            placeholder="g"
            value={form.fiber_g}
            onChange={(e) => setField("fiber_g", e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Adding..." : "Add Food"}
      </Button>
    </form>
  );
}
