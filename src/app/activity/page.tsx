"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Droplets, Footprints, Flame, Loader2 } from "lucide-react";

type Intensity = "low" | "moderate" | "high";

interface ActivityData {
  window_hours: number;
  readiness: number;
  intensity: Intensity;
  metrics: {
    avg_calories_per_day: number;
    avg_protein_g_per_day: number;
    avg_water_oz_per_day: number;
    active_days: number;
  };
  insights: string[];
  top_foods: Array<{ food_name: string; times: number }>;
  recommendations: Array<{
    title: string;
    duration_min: number;
    level: Intensity;
    equipment: "bodyweight" | "dumbbells" | "mixed";
    reason: string;
    moves: string[];
  }>;
}

const STEP_KEY_PREFIX = "activity_steps_v1_";

function localDateKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function targetStepsFor(intensity: Intensity) {
  if (intensity === "high") return 10000;
  if (intensity === "moderate") return 8000;
  return 6000;
}

export default function ActivityPage() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState(0);
  const [tracking, setTracking] = useState(false);
  const [motionSupported, setMotionSupported] = useState(false);
  const [motionMessage, setMotionMessage] = useState("Tap Start to use device motion for step estimates.");

  const stepDateKeyRef = useRef(localDateKey());
  const lastMagnitudeRef = useRef(0);
  const lastStepTsRef = useRef(0);

  useEffect(() => {
    const key = `${STEP_KEY_PREFIX}${stepDateKeyRef.current}`;
    const raw = localStorage.getItem(key);
    const parsed = Number(raw ?? 0);
    if (Number.isFinite(parsed) && parsed > 0) setSteps(Math.floor(parsed));
    setMotionSupported(typeof window !== "undefined" && "DeviceMotionEvent" in window);
  }, []);

  useEffect(() => {
    const key = `${STEP_KEY_PREFIX}${stepDateKeyRef.current}`;
    localStorage.setItem(key, String(steps));
  }, [steps]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/activity", { cache: "no-store" });
        const raw = await res.text().catch(() => "");
        const parsed = raw ? (JSON.parse(raw) as ActivityData | { error?: string }) : null;
        if (!res.ok) {
          throw new Error((parsed as { error?: string } | null)?.error ?? "Failed to load activity recommendations.");
        }
        setData(parsed as ActivityData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load activity recommendations.");
      } finally {
        setLoading(false);
      }
    }
    load().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!tracking) return;
    const onMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity ?? event.acceleration;
      if (!acc) return;
      const x = acc.x ?? 0;
      const y = acc.y ?? 0;
      const z = acc.z ?? 0;
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const delta = Math.abs(magnitude - lastMagnitudeRef.current);
      lastMagnitudeRef.current = magnitude;

      const now = Date.now();
      if (delta > 1.15 && now - lastStepTsRef.current > 300) {
        lastStepTsRef.current = now;
        setSteps((prev) => prev + 1);
      }
    };

    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
    };
  }, [tracking]);

  async function startTracking() {
    if (!motionSupported) {
      setMotionMessage("Device motion is not supported in this browser.");
      return;
    }
    try {
      const dm = DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (typeof dm.requestPermission === "function") {
        const permission = await dm.requestPermission();
        if (permission !== "granted") {
          setMotionMessage("Motion permission was denied. Enable it in browser settings.");
          return;
        }
      }
      setMotionMessage("Tracking steps using device motion.");
      setTracking(true);
    } catch {
      setMotionMessage("Could not start motion tracking on this device.");
    }
  }

  function stopTracking() {
    setTracking(false);
    setMotionMessage("Tracking paused.");
  }

  function resetStepsToday() {
    const today = localDateKey();
    stepDateKeyRef.current = today;
    setSteps(0);
    localStorage.setItem(`${STEP_KEY_PREFIX}${today}`, "0");
  }

  const stepTarget = targetStepsFor(data?.intensity ?? "moderate");
  const progressPct = useMemo(() => Math.min(100, Math.round((steps / stepTarget) * 100)), [steps, stepTarget]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Workout guidance based on your last 72 hours of nutrition and hydration.
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading activity recommendations...
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-6 text-sm text-red-600">{error}</CardContent>
        </Card>
      ) : data ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Dumbbell className="h-4 w-4" />
                Training Readiness
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Last {data.window_hours}h</Badge>
                <Badge variant="secondary" className="capitalize">
                  {data.intensity} intensity
                </Badge>
              </div>
              <p className="text-3xl font-bold">{data.readiness}/100</p>
              <div className="grid sm:grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground flex items-center gap-1"><Flame className="h-3.5 w-3.5" /> Avg calories/day</p>
                  <p className="font-semibold">{data.metrics.avg_calories_per_day}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Avg protein/day</p>
                  <p className="font-semibold">{data.metrics.avg_protein_g_per_day} g</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground flex items-center gap-1"><Droplets className="h-3.5 w-3.5" /> Avg water/day</p>
                  <p className="font-semibold">{data.metrics.avg_water_oz_per_day} oz</p>
                </div>
              </div>
              <div className="space-y-1">
                {data.insights.map((insight, idx) => (
                  <p key={idx} className="text-sm text-muted-foreground">- {insight}</p>
                ))}
              </div>
              {data.top_foods.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Recent staples: {data.top_foods.map((f) => f.food_name).join(", ")}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Footprints className="h-4 w-4" />
                Steps
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold">{steps.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Target: {stepTarget.toLocaleString()} steps</p>
                </div>
                <Badge variant="outline">{progressPct}%</Badge>
              </div>
              <div className="h-2 w-full rounded bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{motionMessage}</p>
              <div className="flex flex-wrap gap-2">
                {!tracking ? (
                  <Button type="button" onClick={startTracking} size="sm">
                    Start Step Tracking
                  </Button>
                ) : (
                  <Button type="button" onClick={stopTracking} size="sm" variant="secondary">
                    Pause Tracking
                  </Button>
                )}
                <Button type="button" onClick={resetStepsToday} size="sm" variant="outline">
                  Reset Today
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Step count uses browser device motion and works best while this page stays open.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {data.recommendations.map((plan, idx) => (
              <Card key={`${plan.title}-${idx}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{plan.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className="capitalize">{plan.equipment}</Badge>
                    <Badge variant="secondary">{plan.duration_min} min</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.reason}</p>
                  <ul className="text-sm space-y-1">
                    {plan.moves.map((move, moveIdx) => (
                      <li key={moveIdx}>- {move}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

