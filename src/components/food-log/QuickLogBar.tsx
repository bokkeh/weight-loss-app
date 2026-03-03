"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2 } from "lucide-react";
import { FoodLogEntry } from "@/types";

interface Props {
  date: string;
  onAdded: (entry: FoodLogEntry) => void;
}

export function QuickLogBar({ date, onAdded }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<null | {
    food_name: string;
    serving_size?: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setPreview(null);

    try {
      const res = await fetch("/api/food-log/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), logged_at: date }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to estimate macros");
      }

      const { entry, macros } = await res.json();
      setPreview(macros);
      onAdded(entry);
      setText("");
      setTimeout(() => setPreview(null), 4000);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="p-[1.5px] rounded-xl bg-gradient-to-r from-violet-400 to-fuchsia-500 shadow-[0_0_18px_rgba(167,139,250,0.45)]">
        <form onSubmit={handleSubmit} className="flex gap-2 bg-background rounded-[10px] px-2 py-1.5">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
            <Input
              className="pl-9 border-0 shadow-none focus-visible:ring-0 bg-transparent"
              placeholder='e.g. "chicken breast 4oz" or "2 scrambled eggs"'
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError("");
              }}
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading || !text.trim()} size="sm" className="shrink-0 my-0.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log"}
          </Button>
        </form>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {preview && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          <span className="font-medium text-foreground">{preview.food_name}</span>
          {preview.serving_size && <span>{preview.serving_size}</span>}
          <span className="ml-auto flex gap-3">
            <span><strong>{Math.round(preview.calories)}</strong> cal</span>
            <span><strong>{preview.protein_g.toFixed(1)}g</strong> protein</span>
            <span><strong>{preview.carbs_g.toFixed(1)}g</strong> carbs</span>
            <span><strong>{preview.fat_g.toFixed(1)}g</strong> fat</span>
          </span>
        </div>
      )}
    </div>
  );
}
