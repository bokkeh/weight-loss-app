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
import { Skeleton } from "@/components/ui/skeleton";
import { WeightEntry } from "@/types";

export default function WeightPage() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [weeks, setWeeks] = useState("12");
  const [loading, setLoading] = useState(true);

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

  const latestWeight = entries.length > 0
    ? Math.max(...entries.map((e) => new Date(e.logged_at).getTime()))
    : null;
  const latestEntry = latestWeight
    ? entries.find((e) => new Date(e.logged_at).getTime() === latestWeight)
    : null;

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
                <WeightTrendChart entries={entries} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
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
