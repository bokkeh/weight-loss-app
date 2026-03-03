"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, BookmarkPlus, Check } from "lucide-react";
import { Recipe } from "@/types";

interface SuggestedRecipe {
  name: string;
  description: string;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  ingredients: string;
  instructions: string;
  tags: string[];
}

interface Props {
  onSaved: (recipe: Recipe) => void;
}

export function RecipeExplorer({ onSaved }: Props) {
  const [preferences, setPreferences] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedRecipe[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuggestions([]);
    setSaved(new Set());

    try {
      const res = await fetch("/api/recipes/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: preferences.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSuggestions(await res.json());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(recipe: SuggestedRecipe, index: number) {
    setSaving(index);
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recipe),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const saved: Recipe = await res.json();
      onSaved(saved);
      setSaved((prev) => new Set([...prev, index]));
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-[1.5px] rounded-xl bg-gradient-to-r from-violet-400 to-fuchsia-500 shadow-[0_0_18px_rgba(167,139,250,0.45)]">
        <form onSubmit={handleGenerate} className="flex gap-2 bg-background rounded-[10px] px-2 py-1.5">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
            <Input
              className="pl-9 border-0 shadow-none focus-visible:ring-0 bg-transparent"
              placeholder='e.g. "high protein", "low carb", "quick meals", "vegetarian"'
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading} size="sm" className="shrink-0 my-0.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
          </Button>
        </form>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {suggestions.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-4">
          {suggestions.map((r, i) => (
            <Card key={i} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base leading-snug">{r.name}</CardTitle>
                {r.description && (
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                )}
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {/* Macros */}
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span className="text-muted-foreground">Calories</span>
                  <span className="font-medium text-right">{Math.round(r.calories)}</span>
                  <span className="text-muted-foreground">Protein</span>
                  <span className="font-medium text-right">{r.protein_g.toFixed(1)}g</span>
                  <span className="text-muted-foreground">Carbs</span>
                  <span className="font-medium text-right">{r.carbs_g.toFixed(1)}g</span>
                  <span className="text-muted-foreground">Fat</span>
                  <span className="font-medium text-right">{r.fat_g.toFixed(1)}g</span>
                </div>

                {/* Tags */}
                {r.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Servings */}
                <p className="text-xs text-muted-foreground">Serves {r.servings} · per serving</p>

                <Button
                  className="w-full"
                  size="sm"
                  variant={saved.has(i) ? "outline" : "default"}
                  disabled={saving === i || saved.has(i)}
                  onClick={() => handleSave(r, i)}
                >
                  {saving === i ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : saved.has(i) ? (
                    <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                  ) : (
                    <BookmarkPlus className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {saved.has(i) ? "Saved!" : saving === i ? "Saving..." : "Save Recipe"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
