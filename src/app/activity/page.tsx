"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Beef, CheckSquare, Dumbbell, Droplets, Footprints, Flame, Loader2, Scale, Sparkles, Square, TrendingDown } from "lucide-react";

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

interface GeneratedWorkout {
  title: string;
  duration_min: number;
  equipment: "bodyweight" | "dumbbells" | "mixed";
  focus: string;
  notes: string;
  checklist: string[];
}

const STEP_KEY_PREFIX = "activity_steps_v1_";
const GENERATED_WORKOUT_KEY = "activity_generated_workout_v1";
const GENERATED_WORKOUT_CHECKED_KEY = "activity_generated_workout_checked_v1";

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
  const [windowHours, setWindowHours] = useState<24 | 72>(72);
  const [workoutMinutes, setWorkoutMinutes] = useState(45);
  const [genLoading, setGenLoading] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
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

    const savedWorkoutRaw = localStorage.getItem(GENERATED_WORKOUT_KEY);
    if (savedWorkoutRaw) {
      try {
        const savedWorkout = JSON.parse(savedWorkoutRaw) as GeneratedWorkout;
        if (savedWorkout?.title && Array.isArray(savedWorkout?.checklist)) {
          setGeneratedWorkout(savedWorkout);
        }
      } catch {
        localStorage.removeItem(GENERATED_WORKOUT_KEY);
      }
    }

    const savedCheckedRaw = localStorage.getItem(GENERATED_WORKOUT_CHECKED_KEY);
    if (savedCheckedRaw) {
      try {
        const savedChecked = JSON.parse(savedCheckedRaw) as Record<number, boolean>;
        if (savedChecked && typeof savedChecked === "object") {
          setCheckedItems(savedChecked);
        }
      } catch {
        localStorage.removeItem(GENERATED_WORKOUT_CHECKED_KEY);
      }
    }
  }, []);

  useEffect(() => {
    const key = `${STEP_KEY_PREFIX}${stepDateKeyRef.current}`;
    localStorage.setItem(key, String(steps));
  }, [steps]);

  useEffect(() => {
    if (generatedWorkout) {
      localStorage.setItem(GENERATED_WORKOUT_KEY, JSON.stringify(generatedWorkout));
    } else {
      localStorage.removeItem(GENERATED_WORKOUT_KEY);
    }
  }, [generatedWorkout]);

  useEffect(() => {
    localStorage.setItem(GENERATED_WORKOUT_CHECKED_KEY, JSON.stringify(checkedItems));
  }, [checkedItems]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/activity?hours=${windowHours}`, { cache: "no-store" });
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
  }, [windowHours]);

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

  async function generateWorkout() {
    if (!data) return;
    setGenLoading(true);
    try {
      const res = await fetch("/api/activity/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          window_hours: data.window_hours,
          intensity: data.intensity,
          insights: data.insights,
          top_foods: data.top_foods,
          target_minutes: Math.max(10, Math.min(120, Number(workoutMinutes) || 45)),
        }),
      });
      const raw = await res.text().catch(() => "");
      const parsed = raw ? (JSON.parse(raw) as GeneratedWorkout | { error?: string }) : null;
      if (!res.ok) {
        throw new Error((parsed as { error?: string } | null)?.error ?? "Failed to generate workout.");
      }
      setGeneratedWorkout(parsed as GeneratedWorkout);
      setCheckedItems({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate workout.");
    } finally {
      setGenLoading(false);
    }
  }

  function clearGeneratedWorkout() {
    setGeneratedWorkout(null);
    setCheckedItems({});
    localStorage.removeItem(GENERATED_WORKOUT_KEY);
    localStorage.removeItem(GENERATED_WORKOUT_CHECKED_KEY);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Workout guidance based on your recent nutrition and hydration.
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
                <Button
                  size="sm"
                  variant={windowHours === 24 ? "default" : "outline"}
                  className="h-7 px-3 text-xs"
                  onClick={() => setWindowHours(24)}
                >
                  Last 24h
                </Button>
                <Button
                  size="sm"
                  variant={windowHours === 72 ? "default" : "outline"}
                  className="h-7 px-3 text-xs"
                  onClick={() => setWindowHours(72)}
                >
                  Last 72h
                </Button>
                <Badge variant="secondary" className="capitalize">
                  {data.intensity} intensity
                </Badge>
                <div className="ml-auto flex items-center gap-2">
                  <div className="w-24">
                    <Input
                      type="number"
                      min={10}
                      max={120}
                      step={5}
                      value={workoutMinutes}
                      onChange={(e) => setWorkoutMinutes(Math.max(10, Math.min(120, Number(e.target.value) || 45)))}
                      className="h-7 text-xs"
                      aria-label="Workout minutes"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">min</span>
                </div>
                {generatedWorkout ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-3 text-xs"
                    onClick={clearGeneratedWorkout}
                    disabled={genLoading}
                  >
                    Clear
                  </Button>
                ) : null}
                <Button size="sm" className="h-7 px-3 text-xs" onClick={generateWorkout} disabled={genLoading}>
                  {genLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                  {generatedWorkout ? "Regenerate" : "Generate Workout"}
                </Button>
              </div>
              <div className="flex items-end gap-2">
                <p className="text-6xl font-black leading-none">{data.readiness}%</p>
                <p className="text-xs text-muted-foreground pb-1">readiness</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                <div className="rounded-lg border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-muted-foreground">Avg calories/day</p>
                      <p className="font-semibold">{data.metrics.avg_calories_per_day}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-orange-50">
                      <Flame className="h-4 w-4 text-orange-600" />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-muted-foreground">Avg protein/day</p>
                      <p className="font-semibold">{data.metrics.avg_protein_g_per_day} g</p>
                    </div>
                    <div className="p-2 rounded-lg bg-purple-50">
                      <Beef className="h-4 w-4 text-purple-600" />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-muted-foreground">Avg water/day</p>
                      <p className="font-semibold">{data.metrics.avg_water_oz_per_day} oz</p>
                    </div>
                    <div className="p-2 rounded-lg bg-blue-50">
                      <Droplets className="h-4 w-4 text-blue-600" />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-muted-foreground">Active days</p>
                      <p className="font-semibold">{data.metrics.active_days}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-green-50">
                      {data.intensity === "high" ? (
                        <TrendingDown className="h-4 w-4 text-green-600" />
                      ) : (
                        <Scale className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                  </div>
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
            {generatedWorkout ? (
              <Card className="overflow-hidden !py-0 gap-0 border-violet-200">
                <CardHeader className="pt-5 pb-3 bg-gradient-to-r from-violet-50 to-fuchsia-50">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-600" />
                      {generatedWorkout.title}
                    </CardTitle>
                    <Badge variant="outline" className="capitalize bg-white/70 border-white">
                      {generatedWorkout.equipment}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                    <Badge variant="secondary">{generatedWorkout.duration_min} min</Badge>
                    <Badge variant="secondary">{generatedWorkout.focus}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 pb-5 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Check off each line as you complete it.
                  </p>
                  <div className="space-y-2">
                    {generatedWorkout.checklist.map((item, idx) => {
                      const checked = Boolean(checkedItems[idx]);
                      return (
                        <button
                          key={`${item}-${idx}`}
                          type="button"
                          onClick={() => setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                          className="w-full text-left rounded-md border bg-muted/20 px-3 py-2 text-sm flex items-center gap-2"
                        >
                          {checked ? (
                            <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span className={checked ? "line-through text-muted-foreground" : ""}>{item}</span>
                        </button>
                      );
                    })}
                  </div>
                  {generatedWorkout.notes ? (
                    <p className="text-xs text-muted-foreground">{generatedWorkout.notes}</p>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Enter minutes and tap <span className="font-medium">Generate Workout</span> to create your checklist plan.
                </CardContent>
              </Card>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
