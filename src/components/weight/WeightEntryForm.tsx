"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sunrise, Sunset } from "lucide-react";
import { WeightEntry } from "@/types";

interface Props {
  onAdded: (entry: WeightEntry) => void;
}

export function WeightEntryForm({ onAdded }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [morning, setMorning] = useState("");
  const [evening, setEvening] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitEntry(weight_lbs: number, time_of_day: "morning" | "evening") {
    const res = await fetch("/api/weight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logged_at: date,
        weight_lbs,
        time_of_day,
        note: note || undefined,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<WeightEntry>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!morning && !evening) {
      setError("Enter at least a morning or evening weight.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      if (morning) {
        const entry = await submitEntry(parseFloat(morning), "morning");
        onAdded(entry);
      }
      if (evening) {
        const entry = await submitEntry(parseFloat(evening), "evening");
        onAdded(entry);
      }
      setMorning("");
      setEvening("");
      setNote("");
      setDate(today);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log Weight</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="weight-date">Date</Label>
            <Input
              id="weight-date"
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="weight-morning" className="flex items-center gap-1.5">
                <Sunrise className="h-3.5 w-3.5 text-yellow-500" />
                Morning (lbs)
              </Label>
              <Input
                id="weight-morning"
                type="number"
                step="0.1"
                min="0"
                placeholder="185.5"
                value={morning}
                onChange={(e) => setMorning(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="weight-evening" className="flex items-center gap-1.5">
                <Sunset className="h-3.5 w-3.5 text-orange-500" />
                Evening (lbs)
              </Label>
              <Input
                id="weight-evening"
                type="number"
                step="0.1"
                min="0"
                placeholder="186.2"
                value={evening}
                onChange={(e) => setEvening(e.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground -mt-1">
            Fill in one or both — skip whichever reading you missed.
          </p>

          <div className="space-y-1">
            <Label htmlFor="weight-note">Note (optional)</Label>
            <Textarea
              id="weight-note"
              placeholder="How are you feeling today?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Log Weight"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
