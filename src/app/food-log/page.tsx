"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FoodEntryForm } from "@/components/food-log/FoodEntryForm";
import { FoodLogTable } from "@/components/food-log/FoodLogTable";
import { MacroProgressBars } from "@/components/food-log/MacroProgressBars";
import { QuickLogBar } from "@/components/food-log/QuickLogBar";
import { Skeleton } from "@/components/ui/skeleton";
import { FoodLogEntry, DailyMacroTotals } from "@/types";

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function shiftDate(d: Date, days: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}

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

export default function FoodLogPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const today = new Date();
  const isToday = toDateStr(selectedDate) === toDateStr(today);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/food-log?date=${toDateStr(selectedDate)}`);
      const data = await res.json();
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  function handleAdded(entry: FoodLogEntry) {
    setEntries((prev) => [...prev, entry]);
    setOpen(false);
  }

  async function handleDelete(id: number) {
    await fetch(`/api/food-log/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const totals = sumMacros(entries);

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Food Log</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track your daily calories and macros.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>+ Add Food</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Log Food</DialogTitle>
            </DialogHeader>
            <FoodEntryForm date={toDateStr(selectedDate)} onAdded={handleAdded} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Log */}
      <QuickLogBar date={toDateStr(selectedDate)} onAdded={handleAdded} />

      {/* Date Navigator */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center min-w-44">
          <p className="font-semibold">
            {isToday
              ? "Today"
              : selectedDate.toLocaleDateString("en-US", {
                  weekday: "long",
                })}
          </p>
          <p className="text-sm text-muted-foreground">
            {selectedDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
          disabled={isToday}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Daily Goals</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <MacroProgressBars totals={totals} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Meals</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <FoodLogTable entries={entries} onDelete={handleDelete} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
