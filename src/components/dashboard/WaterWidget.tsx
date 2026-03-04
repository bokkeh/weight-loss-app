"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Droplets, Minus, Plus } from "lucide-react";
import { WaterLogEntry } from "@/types";
import { localDateStr } from "@/lib/utils";

const GLASS_OZ = 8;
const BASE_HYDRATION_OZ = 64;
const OZ_PER_1000MG_SODIUM = 12;
const MIN_RECOMMENDED_OZ = 64;
const MAX_RECOMMENDED_OZ = 160;

function roundToNearest8(n: number): number {
  return Math.round(n / 8) * 8;
}

function calcRecommended(sodiumMg: number): number {
  const extra = (sodiumMg / 1000) * OZ_PER_1000MG_SODIUM;
  const raw = BASE_HYDRATION_OZ + extra;
  const clamped = Math.min(MAX_RECOMMENDED_OZ, Math.max(MIN_RECOMMENDED_OZ, raw));
  return roundToNearest8(clamped);
}

interface WaterWidgetProps {
  sodiumMgToday: number;
  hasFoodLogged: boolean;
}

export function WaterWidget({ sodiumMgToday, hasFoodLogged }: WaterWidgetProps) {
  const [entries, setEntries] = useState<WaterLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);

  const today = localDateStr();

  const load = useCallback(async () => {
    const res = await fetch(`/api/water?date=${today}`);
    const data = await res.json();
    setEntries(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const consumedOz = entries.reduce((sum, e) => sum + Number(e.ounces), 0);
  const recommended = calcRecommended(sodiumMgToday);
  const pct = Math.min(1, consumedOz / recommended);
  const glassesLogged = Math.round(consumedOz / GLASS_OZ);
  const glassesNeeded = Math.round(recommended / GLASS_OZ);

  async function handleAdd() {
    if (adding) return;
    setAdding(true);

    const tempId = Date.now() * -1;
    const optimistic: WaterLogEntry = {
      id: tempId,
      logged_at: today,
      ounces: GLASS_OZ,
      source: "sodium_widget",
      created_at: new Date().toISOString(),
    };
    setEntries((prev) => [...prev, optimistic]);

    try {
      const res = await fetch("/api/water", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logged_at: today, ounces: GLASS_OZ, source: "sodium_widget" }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const saved: WaterLogEntry = await res.json();
      setEntries((prev) => prev.map((e) => (e.id === tempId ? saved : e)));
    } catch (err) {
      setEntries((prev) => prev.filter((e) => e.id !== tempId));
      console.error("Failed to save water entry:", err);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveLast() {
    if (removing || entries.length === 0) return;
    // Last entry in the sorted list (most recently added)
    const last = entries[entries.length - 1];
    setRemoving(true);

    // Optimistic remove
    setEntries((prev) => prev.filter((e) => e.id !== last.id));

    try {
      const res = await fetch(`/api/water?id=${last.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
    } catch (err) {
      // Rollback: reload from server
      console.error("Failed to remove water entry:", err);
      load();
    } finally {
      setRemoving(false);
    }
  }

  const progressColor =
    pct >= 1 ? "bg-green-500" : pct >= 0.6 ? "bg-sky-500" : "bg-sky-400";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Droplets className="h-4 w-4 text-sky-500" />
          Water to Offset Sodium
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasFoodLogged ? (
          <p className="text-sm text-muted-foreground">
            Log a meal to calculate today&apos;s target.
          </p>
        ) : (
          <>
            {/* Recommended / Consumed numbers */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-sky-500">
                  {loading ? "—" : `${consumedOz}`}
                  <span className="text-base font-normal text-muted-foreground ml-1">oz</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">consumed</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold">{recommended} oz</p>
                <p className="text-xs text-muted-foreground">recommended</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {loading ? "…" : `${glassesLogged} / ${glassesNeeded} glasses`}
                </span>
                <span>{Math.round(pct * 100)}%</span>
              </div>
            </div>

            {/* Helper text */}
            <p className="text-xs text-muted-foreground">
              Based on today&apos;s sodium intake ({Math.round(sodiumMgToday).toLocaleString()} mg).
            </p>

            {/* Buttons */}
            <div className="flex gap-2 items-center">
              {entries.length > 0 && (
                <Button
                  onClick={handleRemoveLast}
                  disabled={removing}
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  aria-label="Remove last glass"
                >
                  <Minus className="h-4 w-4" />
                </Button>
              )}
              <Button
                onClick={handleAdd}
                disabled={adding}
                size="sm"
                className="flex-1 gap-1.5 bg-sky-500 hover:bg-sky-600 text-white"
              >
                <Plus className="h-4 w-4" />
                Add Glass (8 oz)
              </Button>
            </div>

            {pct >= 1 && (
              <p className="text-xs text-center text-green-600 font-medium">
                Goal reached! 🎉 Sodium defeated.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
