"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WeightEntryForm } from "@/components/weight/WeightEntryForm";
import { WeightTrendChart } from "@/components/weight/WeightTrendChart";
import { WeightHistoryTable } from "@/components/weight/WeightHistoryTable";
import { GoalWeightCard } from "@/components/weight/GoalWeightCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { WeightEntry } from "@/types";
import { shareOrCopy } from "@/lib/shareUtils";
import { Share2, Check } from "lucide-react";

export default function WeightPage() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [weeks, setWeeks] = useState("12");
  const [loading, setLoading] = useState(true);
  const [shareLabel, setShareLabel] = useState<"share" | "done">("share");
  const [goalWeight, setGoalWeight] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const v = localStorage.getItem("goalWeight");
    return v ? parseFloat(v) : null;
  });

  function handleGoalSet(goal: number) {
    setGoalWeight(goal);
    localStorage.setItem("goalWeight", String(goal));
  }

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/weight?weeks=${weeks}`);
      const data = await res.json();
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [weeks]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  function handleAdded(entry: WeightEntry) {
    setEntries((prev) => [entry, ...prev]);
  }

  async function handleDelete(id: number) {
    await fetch(`/api/weight/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleShareHistory() {
    if (entries.length === 0) return;

    const sorted = [...entries].sort((a, b) => {
      const dateCmp = b.logged_at.localeCompare(a.logged_at);
      if (dateCmp !== 0) return dateCmp;
      return (a.time_of_day ?? "").localeCompare(b.time_of_day ?? "");
    });

    const lines = [
      `Weight Log - Last ${weeks} week${weeks === "1" ? "" : "s"}`,
      "",
      ...sorted.map((entry) => {
        const slot =
          entry.time_of_day === "morning"
            ? "morning"
            : entry.time_of_day === "evening"
              ? "evening"
              : "entry";
        return `${entry.logged_at} (${slot}): ${Number(entry.weight_lbs).toFixed(1)} lbs${entry.note ? ` - ${entry.note}` : ""}`;
      }),
    ];

    await shareOrCopy(lines.join("\n"), "Weight Log");
    setShareLabel("done");
    setTimeout(() => setShareLabel("share"), 2000);
  }

  const sortedEntries = [...entries].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  const latestEntry = sortedEntries[0] ?? null;
  const oldestEntry = sortedEntries[sortedEntries.length - 1] ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Weight Tracker</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Log your daily weigh-ins and track your progress over time.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <WeightEntryForm onAdded={handleAdded} />
          {latestEntry && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Latest Weight</p>
                <p className="text-3xl font-bold">
                  {Number(latestEntry.weight_lbs).toFixed(1)}{" "}
                  <span className="text-lg font-normal text-muted-foreground">lbs</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(latestEntry.logged_at + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </CardContent>
            </Card>
          )}
          <GoalWeightCard
            startWeight={oldestEntry ? Number(oldestEntry.weight_lbs) : null}
            currentWeight={latestEntry ? Number(latestEntry.weight_lbs) : null}
            goalWeight={goalWeight}
            onGoalSet={handleGoalSet}
          />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Trend</CardTitle>
              <Select value={weeks} onValueChange={setWeeks}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">Last 4 weeks</SelectItem>
                  <SelectItem value="8">Last 8 weeks</SelectItem>
                  <SelectItem value="12">Last 12 weeks</SelectItem>
                  <SelectItem value="52">Last year</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <WeightTrendChart entries={entries} goalWeight={goalWeight ?? undefined} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>History</CardTitle>
              {!loading && entries.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleShareHistory} className="h-8 gap-1.5">
                  {shareLabel === "done" ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-600" />
                      Shared
                    </>
                  ) : (
                    <>
                      <Share2 className="h-3.5 w-3.5" />
                      Share
                    </>
                  )}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <WeightHistoryTable entries={entries} onDelete={handleDelete} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
