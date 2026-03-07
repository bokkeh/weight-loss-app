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
import { Share2, Check, TrendingUp } from "lucide-react";

function estimateGoalPace(entries: WeightEntry[], goalWeight: number | null): { text: string; subtext: string } | null {
  if (!goalWeight || entries.length < 3) return null;

  const grouped = new Map<string, { total: number; count: number }>();
  for (const e of entries) {
    const key = String(e.logged_at).slice(0, 10);
    const curr = grouped.get(key) ?? { total: 0, count: 0 };
    curr.total += Number(e.weight_lbs);
    curr.count += 1;
    grouped.set(key, curr);
  }

  const daily = [...grouped.entries()]
    .map(([date, v]) => ({ date, weight: v.total / v.count }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (daily.length < 3) return null;

  const x0 = new Date(`${daily[0].date}T12:00:00`).getTime();
  const points = daily.map((d) => ({
    x: (new Date(`${d.date}T12:00:00`).getTime() - x0) / 86_400_000,
    y: d.weight,
  }));
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;

  const slopePerDay = (n * sumXY - sumX * sumY) / denom;
  const current = daily[daily.length - 1].weight;
  const remaining = goalWeight - current;
  const movingTowardGoal =
    (remaining < 0 && slopePerDay < 0) || (remaining > 0 && slopePerDay > 0);

  if (!movingTowardGoal || Math.abs(slopePerDay) < 0.01) {
    return {
      text: "Trend is too flat to estimate goal timing yet",
      subtext: "Log a few more consistent weigh-ins to improve projection confidence.",
    };
  }

  const daysToGoal = Math.ceil(Math.abs(remaining / slopePerDay));
  const weeksToGoal = Math.ceil(daysToGoal / 7);
  const weeklyRate = Math.abs(slopePerDay * 7);

  return {
    text: `At this pace: about ${daysToGoal} days (${weeksToGoal} weeks) to goal`,
    subtext: `Current trend: ~${weeklyRate.toFixed(2)} lbs/week`,
  };
}

async function buildWeightTrendSnapshotImage(entries: WeightEntry[], weeks: string, goalWeight: number | null): Promise<File> {
  const sorted = [...entries]
    .filter((e) => Number.isFinite(Number(e.weight_lbs)))
    .sort((a, b) => {
      const dateCmp = a.logged_at.localeCompare(b.logged_at);
      if (dateCmp !== 0) return dateCmp;
      const rank = (v: WeightEntry["time_of_day"]) => (v === "morning" ? 0 : v === "evening" ? 1 : 2);
      return rank(a.time_of_day) - rank(b.time_of_day);
    });

  const width = 1180;
  const height = 860;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create chart image.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#111827";
  ctx.font = "700 52px Arial";
  ctx.fillText(`Weight Trend (Last ${weeks} Week${weeks === "1" ? "" : "s"})`, 60, 90);
  ctx.fillStyle = "#6b7280";
  ctx.font = "400 24px Arial";
  ctx.fillText(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), 60, 130);

  const left = 90;
  const top = 190;
  const chartW = width - 170;
  const chartH = 430;
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, chartW, chartH);

  if (sorted.length > 0) {
    const values = sorted.map((e) => Number(e.weight_lbs));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    const minY = Math.floor(min - 2);
    const maxY = Math.ceil(max + 2);
    const yRange = Math.max(1, maxY - minY);

    const xStep = sorted.length > 1 ? chartW / (sorted.length - 1) : 0;
    const yFor = (v: number) => top + chartH - ((v - minY) / yRange) * chartH;

    ctx.fillStyle = "#64748b";
    ctx.font = "400 18px Arial";
    for (let i = 0; i <= 4; i += 1) {
      const y = top + (chartH * i) / 4;
      const val = (maxY - (yRange * i) / 4).toFixed(0);
      ctx.fillText(val, 35, y + 6);
      ctx.strokeStyle = "#f1f5f9";
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + chartW, y);
      ctx.stroke();
    }

    if (goalWeight != null && Number.isFinite(goalWeight)) {
      const gy = yFor(goalWeight);
      ctx.strokeStyle = "#22c55e";
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(left, gy);
      ctx.lineTo(left + chartW, gy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#16a34a";
      ctx.font = "600 18px Arial";
      ctx.fillText(`Goal ${goalWeight.toFixed(1)} lbs`, left + chartW - 170, gy - 8);
    }

    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3;
    ctx.beginPath();
    sorted.forEach((entry, idx) => {
      const x = left + idx * xStep;
      const y = yFor(Number(entry.weight_lbs));
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = "#2563eb";
    sorted.forEach((entry, idx) => {
      const x = left + idx * xStep;
      const y = yFor(Number(entry.weight_lbs));
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    const last = sorted[sorted.length - 1];
    const first = sorted[0];
    const delta = Number(last.weight_lbs) - Number(first.weight_lbs);
    ctx.fillStyle = "#111827";
    ctx.font = "600 26px Arial";
    ctx.fillText(`Current: ${Number(last.weight_lbs).toFixed(1)} lbs`, 60, 700);
    ctx.fillText(`Change: ${delta > 0 ? "+" : ""}${delta.toFixed(1)} lbs`, 420, 700);
    if (goalWeight != null) {
      ctx.fillText(`Goal: ${goalWeight.toFixed(1)} lbs`, 740, 700);
    }
  } else {
    ctx.fillStyle = "#6b7280";
    ctx.font = "500 26px Arial";
    ctx.fillText("No trend data available yet.", 60, 260);
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Failed to build trend snapshot.");
  return new File([blob], `weight-trend-${weeks}w.png`, { type: "image/png" });
}

export default function WeightPage() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [weeks, setWeeks] = useState("12");
  const [loading, setLoading] = useState(true);
  const [shareLabel, setShareLabel] = useState<"share" | "done">("share");
  const [trendShareLabel, setTrendShareLabel] = useState<"share" | "done">("share");
  const [goalWeight, setGoalWeight] = useState<number | null>(null);

  async function handleGoalSet(goal: number) {
    setGoalWeight(goal);
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal_weight_lbs: goal,
        onboarding_completed: true,
      }),
    });
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

  useEffect(() => {
    async function loadGoal() {
      const res = await fetch("/api/profile");
      const profile = (await res.json().catch(() => null)) as { goal_weight_lbs?: number | null } | null;
      if (res.ok && profile?.goal_weight_lbs != null) {
        setGoalWeight(Number(profile.goal_weight_lbs));
      }
    }
    loadGoal().catch(() => undefined);
  }, []);

  function handleAdded(entry: WeightEntry) {
    setEntries((prev) => [entry, ...prev]);
  }

  async function handleDelete(id: number) {
    await fetch(`/api/weight/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function shareTrendSnapshot(setter: (value: "share" | "done") => void) {
    if (entries.length === 0) return;
    const file = await buildWeightTrendSnapshotImage(entries, weeks, goalWeight);
    const nav = navigator as Navigator & { canShare?: (data: { files?: File[] }) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({
        title: "Weight Trend",
        text: "Weight tracker trend snapshot",
        files: [file],
      });
    } else {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
    setter("done");
    setTimeout(() => setter("share"), 2000);
  }

  async function handleShareHistory() {
    await shareTrendSnapshot(setShareLabel);
  }

  async function handleShareTrend() {
    await shareTrendSnapshot(setTrendShareLabel);
  }

  const sortedEntries = [...entries].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  const latestEntry = sortedEntries[0] ?? null;
  const oldestEntry = sortedEntries[sortedEntries.length - 1] ?? null;
  const paceEstimate = estimateGoalPace(entries, goalWeight);

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
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-600" />
                Goal Pace Projection
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paceEstimate ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium">{paceEstimate.text}</p>
                  <p className="text-xs text-muted-foreground">{paceEstimate.subtext}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Add a goal and at least 3 days of weight logs to project your timeline.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Trend</CardTitle>
              <div className="flex items-center gap-2">
                {!loading && entries.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleShareTrend} className="h-8 gap-1.5">
                    {trendShareLabel === "done" ? (
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
              </div>
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
