"use client";

import { useState, useRef, useEffect } from "react";
import { Trash2, Bot, ChefHat, X, Check, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FoodLogEntry, DailyMacroTotals } from "@/types";
import { formatFoodName } from "@/lib/utils";

interface Props {
  entries: FoodLogEntry[];
  onDelete: (id: number) => void;
  onUpdated: (entry: FoodLogEntry) => void;
  onReordered?: (nextEntries: FoodLogEntry[]) => void;
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
      sugar_g: acc.sugar_g + Number(e.sugar_g ?? 0),
      sodium_mg: acc.sodium_mg + Number(e.sodium_mg),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 }
  );
}

interface EditForm {
  food_name: string;
  serving_size: string;
  meal_type: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  sugar_g: string;
  sodium_mg: string;
}

function toEditForm(e: FoodLogEntry): EditForm {
  return {
    food_name: e.food_name,
    serving_size: e.serving_size ?? "",
    meal_type: e.meal_type ?? "snack",
    calories: String(Number(e.calories).toFixed(0)),
    protein_g: String(Number(e.protein_g).toFixed(1)),
    carbs_g: String(Number(e.carbs_g).toFixed(1)),
    fat_g: String(Number(e.fat_g).toFixed(1)),
    fiber_g: String(Number(e.fiber_g).toFixed(1)),
    sugar_g: String(Number(e.sugar_g ?? 0).toFixed(1)),
    sodium_mg: String(Number(e.sodium_mg ?? 0).toFixed(0)),
  };
}

function InlineEditForm({
  entry,
  onSave,
  onCancel,
}: {
  entry: FoodLogEntry;
  onSave: (updated: FoodLogEntry) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<EditForm>(toEditForm(entry));
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  function setField(key: keyof EditForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.food_name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/food-log/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_name: form.food_name.trim(),
          serving_size: form.serving_size || null,
          meal_type: form.meal_type || null,
          calories: parseFloat(form.calories) || 0,
          protein_g: parseFloat(form.protein_g) || 0,
          carbs_g: parseFloat(form.carbs_g) || 0,
          fat_g: parseFloat(form.fat_g) || 0,
          fiber_g: parseFloat(form.fiber_g) || 0,
          sugar_g: parseFloat(form.sugar_g) || 0,
          sodium_mg: parseFloat(form.sodium_mg) || 0,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated: FoodLogEntry = await res.json();
      onSave(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 p-3 rounded-lg border bg-muted/40 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Input
            ref={nameRef}
            placeholder="Food name"
            value={form.food_name}
            onChange={(e) => setField("food_name", e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <Input
          placeholder="Serving size"
          value={form.serving_size}
          onChange={(e) => setField("serving_size", e.target.value)}
          className="h-8 text-sm"
        />
        <Select value={form.meal_type} onValueChange={(v) => setField("meal_type", v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEAL_ORDER.map((m) => (
              <SelectItem key={m} value={m}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Calories"
          type="number" min="0"
          value={form.calories}
          onChange={(e) => setField("calories", e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Protein (g)"
          type="number" min="0" step="0.1"
          value={form.protein_g}
          onChange={(e) => setField("protein_g", e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Carbs (g)"
          type="number" min="0" step="0.1"
          value={form.carbs_g}
          onChange={(e) => setField("carbs_g", e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Fat (g)"
          type="number" min="0" step="0.1"
          value={form.fat_g}
          onChange={(e) => setField("fat_g", e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Fiber (g)"
          type="number" min="0" step="0.1"
          value={form.fiber_g}
          onChange={(e) => setField("fiber_g", e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Sugar (g)"
          type="number" min="0" step="0.1"
          value={form.sugar_g}
          onChange={(e) => setField("sugar_g", e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Sodium (mg)"
          type="number" min="0"
          value={form.sodium_mg}
          onChange={(e) => setField("sodium_mg", e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 px-3 text-xs">
          <X className="h-3 w-3 mr-1" /> Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !form.food_name.trim()} className="h-7 px-3 text-xs">
          <Check className="h-3 w-3 mr-1" /> {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

function normalizeMealType(meal: string): FoodLogEntry["meal_type"] {
  if (meal === "other") return null;
  return MEAL_ORDER.includes(meal as (typeof MEAL_ORDER)[number])
    ? (meal as FoodLogEntry["meal_type"])
    : "snack";
}

function byOrder(a: FoodLogEntry, b: FoodLogEntry) {
  const ao = Number.isFinite(Number(a.display_order)) ? Number(a.display_order) : Number.MAX_SAFE_INTEGER;
  const bo = Number.isFinite(Number(b.display_order)) ? Number(b.display_order) : Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function formatEntryTimestamp(entry: FoodLogEntry): string {
  const created = new Date(entry.created_at);
  if (!Number.isNaN(created.getTime())) {
    return `Logged ${created.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }
  return `Logged ${entry.logged_at}`;
}

export function FoodLogTable({ entries, onDelete, onUpdated, onReordered }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [savingReorder, setSavingReorder] = useState(false);

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
    items: entries.filter((e) => e.meal_type === meal).sort(byOrder),
  })).filter((g) => g.items.length > 0);

  const ungrouped = entries.filter(
    (e) => !MEAL_ORDER.includes(e.meal_type as "breakfast" | "lunch" | "dinner" | "snack")
  ).sort(byOrder);

  const allGroups = [
    ...grouped,
    ...(ungrouped.length > 0 ? [{ meal: "other" as const, items: ungrouped }] : []),
  ];

  async function persistReorder(
    draggedId: number,
    targetMeal: string,
    targetIndex: number | null
  ) {
    const dragged = entries.find((e) => e.id === draggedId);
    if (!dragged || savingReorder) return;

    const sourceMeal = dragged.meal_type ?? "other";
    const normalizedMeal = normalizeMealType(targetMeal);
    const sourceList = entries
      .filter((e) => (e.meal_type ?? "other") === sourceMeal && e.id !== draggedId)
      .sort(byOrder);
    const targetListBase = entries
      .filter((e) => (e.meal_type ?? "other") === targetMeal && e.id !== draggedId)
      .sort(byOrder);

    const insertAt = targetIndex == null ? targetListBase.length : Math.max(0, Math.min(targetIndex, targetListBase.length));
    const targetList = [...targetListBase];
    targetList.splice(insertAt, 0, { ...dragged, meal_type: normalizedMeal });

    const changed = new Map<number, FoodLogEntry>();
    const nextEntries = entries.map((entry) => ({ ...entry }));

    const applyOrder = (list: FoodLogEntry[], meal: FoodLogEntry["meal_type"]) => {
      list.forEach((entry, idx) => {
        const next = nextEntries.find((e) => e.id === entry.id);
        if (!next) return;
        const nextOrder = (idx + 1) * 10;
        const nextMeal = meal;
        if (next.display_order !== nextOrder || next.meal_type !== nextMeal) {
          next.display_order = nextOrder;
          next.meal_type = nextMeal;
          changed.set(next.id, { ...next });
        }
      });
    };

    applyOrder(targetList, normalizedMeal);
    if (sourceMeal !== targetMeal) {
      applyOrder(sourceList, normalizeMealType(sourceMeal));
    }

    if (changed.size === 0) return;
    onReordered?.(nextEntries);
    setSavingReorder(true);
    try {
      for (const entry of changed.values()) {
        const res = await fetch(`/api/food-log/${entry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meal_type: entry.meal_type,
            display_order: entry.display_order ?? null,
          }),
        });
        if (!res.ok) continue;
        const updated = (await res.json()) as FoodLogEntry;
        onUpdated(updated);
      }
    } finally {
      setSavingReorder(false);
    }
  }

  return (
    <div className="space-y-4">
      {allGroups.map(({ meal, items }) => (
        <div key={meal}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full ${MEAL_COLORS[meal] ?? ""}`}>
              {meal.charAt(0).toUpperCase() + meal.slice(1)}
            </span>
            <span className="text-xs text-muted-foreground">
              {sumMacros(items).calories.toFixed(0)} kcal • {sumMacros(items).sodium_mg.toFixed(0)} mg sodium
            </span>
          </div>

          <div
            className="rounded-md border divide-y"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const fromId = Number(e.dataTransfer.getData("text/plain") || draggingId);
              if (!fromId) return;
              persistReorder(fromId, meal, null).catch(() => undefined);
              setDraggingId(null);
            }}
          >
            {items.map((entry) => (
              <div
                key={entry.id}
                className={`px-3 py-2 ${draggingId === entry.id ? "opacity-60" : ""}`}
                draggable={!savingReorder}
                onDragStart={(e) => {
                  setDraggingId(entry.id);
                  e.dataTransfer.setData("text/plain", String(entry.id));
                }}
                onDragEnd={() => setDraggingId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId = Number(e.dataTransfer.getData("text/plain") || draggingId);
                  if (!fromId || fromId === entry.id) return;
                  const idx = items.findIndex((it) => it.id === entry.id);
                  persistReorder(fromId, meal, idx).catch(() => undefined);
                  setDraggingId(null);
                }}
              >
                {/* Main row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <GripVertical className="h-4 w-4 text-muted-foreground/60 shrink-0 cursor-grab" />
                    {entry.source === "ai_chat" && (
                      <Bot className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                    )}
                    {entry.source === "recipe" && (
                      <ChefHat className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <button
                        onClick={() => setEditingId(editingId === entry.id ? null : entry.id)}
                        className="text-sm font-medium text-left hover:underline underline-offset-2 cursor-pointer leading-snug"
                      >
                        {formatFoodName(entry.food_name)}
                        {entry.serving_size && (
                          <span className="text-xs text-muted-foreground font-normal ml-1">
                            ({entry.serving_size})
                          </span>
                        )}
                      </button>
                      {/* Macro pills */}
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="text-xs font-mono text-orange-600">{Number(entry.calories).toFixed(0)} cal</span>
                        <span className="text-xs font-mono text-blue-600">{Number(entry.protein_g).toFixed(1)}g P</span>
                        <span className="text-xs font-mono text-yellow-600">{Number(entry.carbs_g).toFixed(1)}g C</span>
                        <span className="text-xs font-mono text-red-600">{Number(entry.fat_g).toFixed(1)}g F</span>
                        <span className="text-xs font-mono text-cyan-600">{Number(entry.sodium_mg).toFixed(0)}mg Na</span>
                        {Number(entry.fiber_g) > 0 && (
                          <span className="text-xs font-mono text-green-600">{Number(entry.fiber_g).toFixed(1)}g Fiber</span>
                        )}
                        {Number(entry.sugar_g ?? 0) > 0 && (
                          <span className="text-xs font-mono text-pink-600">{Number(entry.sugar_g).toFixed(1)}g Sugar</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{formatEntryTimestamp(entry)}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 self-center"
                    onClick={() => onDelete(entry.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Inline edit form */}
                {editingId === entry.id && (
                  <InlineEditForm
                    entry={entry}
                    onSave={(updated) => {
                      onUpdated(updated);
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="rounded-md border bg-muted/50 px-4 py-3">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <span className="font-semibold text-sm">Daily Totals</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-mono">
            <span className="text-orange-600 font-bold">{totals.calories.toFixed(0)} kcal</span>
            <span className="text-blue-600">P: {totals.protein_g.toFixed(1)}g</span>
            <span className="text-yellow-600">C: {totals.carbs_g.toFixed(1)}g</span>
            <span className="text-red-600">F: {totals.fat_g.toFixed(1)}g</span>
            <span className="text-green-600">Fiber: {totals.fiber_g.toFixed(1)}g</span>
            <span className="text-pink-600">Sugar: {totals.sugar_g.toFixed(1)}g</span>
            <span className="text-cyan-600">Na: {totals.sodium_mg.toFixed(0)}mg</span>
          </div>
        </div>
      </div>
    </div>
  );
}
