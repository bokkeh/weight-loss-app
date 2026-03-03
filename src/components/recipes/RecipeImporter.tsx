"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Link2, Loader2, BookmarkPlus, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Recipe } from "@/types";

interface ExtractedRecipe {
  name: string;
  description: string;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  ingredients: string;
  instructions: string;
  tags: string[];
}

interface Props {
  onSaved: (recipe: Recipe) => void;
}

export function RecipeImporter({ onSaved }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ recipe: ExtractedRecipe; imageUrl: string | null } | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setSaved(false);

    try {
      const res = await fetch("/api/recipes/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...result.recipe,
          image_url: result.imageUrl ?? undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const saved: Recipe = await res.json();
      onSaved(saved);
      setSaved(true);
      setResult(null);
      setUrl("");
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-[1.5px] rounded-xl bg-gradient-to-r from-violet-400 to-fuchsia-500 shadow-[0_0_18px_rgba(167,139,250,0.45)]">
        <form onSubmit={handleExtract} className="flex gap-2 bg-background rounded-[10px] px-2 py-1.5">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
            <Input
              className="pl-9 border-0 shadow-none focus-visible:ring-0 bg-transparent"
              placeholder="Paste a recipe blog URL..."
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(""); }}
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading || !url.trim()} size="sm" className="shrink-0 my-0.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Extract"}
          </Button>
        </form>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {saved && (
        <p className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1.5">
          <Check className="h-4 w-4" /> Recipe saved to your library!
        </p>
      )}

      {result && (
        <Card>
          <CardContent className="p-0 overflow-hidden">
            {result.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.imageUrl}
                alt={result.recipe.name}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-4 space-y-3">
              <div>
                <h3 className="font-semibold text-base leading-snug">{result.recipe.name}</h3>
                {result.recipe.description && (
                  <p className="text-xs text-muted-foreground mt-1">{result.recipe.description}</p>
                )}
              </div>

              {/* Macros grid */}
              <div className="grid grid-cols-4 gap-2 text-xs text-center">
                {[
                  { label: "Calories", value: Math.round(result.recipe.calories), unit: "" },
                  { label: "Protein", value: result.recipe.protein_g.toFixed(1), unit: "g" },
                  { label: "Carbs", value: result.recipe.carbs_g.toFixed(1), unit: "g" },
                  { label: "Fat", value: result.recipe.fat_g.toFixed(1), unit: "g" },
                ].map(({ label, value, unit }) => (
                  <div key={label} className="bg-muted rounded-md py-2">
                    <p className="font-semibold">{value}{unit}</p>
                    <p className="text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {/* Tags */}
              {result.recipe.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {result.recipe.tags.map((t) => (
                    <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              )}

              {/* Collapsible ingredients + instructions */}
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showDetails ? "Hide" : "Show"} ingredients & instructions
              </button>

              {showDetails && (
                <div className="space-y-3 text-xs border-t pt-3">
                  <div>
                    <p className="font-medium mb-1">Ingredients</p>
                    <pre className="whitespace-pre-wrap text-muted-foreground font-sans leading-relaxed">
                      {result.recipe.ingredients}
                    </pre>
                  </div>
                  <div>
                    <p className="font-medium mb-1">Instructions</p>
                    <pre className="whitespace-pre-wrap text-muted-foreground font-sans leading-relaxed">
                      {result.recipe.instructions}
                    </pre>
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <BookmarkPlus className="h-3.5 w-3.5 mr-1.5" />
                )}
                {saving ? "Saving..." : "Save to Library"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
