"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { RecipeDetail } from "@/components/recipes/RecipeDetail";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import { RecipeExplorer } from "@/components/recipes/RecipeExplorer";
import { RecipeImporter } from "@/components/recipes/RecipeImporter";
import { Recipe } from "@/types";
import { Search, Plus, ChefHat, Sparkles, X, Link2 } from "lucide-react";

type SortKey = "newest" | "name" | "cal-asc" | "cal-desc" | "protein-desc";

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest",
  name: "Name A–Z",
  "cal-asc": "Calories ↑",
  "cal-desc": "Calories ↓",
  "protein-desc": "Protein ↓",
};

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [logSuccess, setLogSuccess] = useState("");
  const [grocerySuccess, setGrocerySuccess] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/recipes");
        const raw = await res.text().catch(() => "");
        const data = raw ? JSON.parse(raw) : [];
        if (!res.ok) {
          const msg = typeof data?.error === "string" ? data.error : "Failed to load recipes";
          throw new Error(msg);
        }
        setRecipes(Array.isArray(data) ? data : []);
      } catch (err) {
        setRecipes([]);
        setLoadError(err instanceof Error ? err.message : "Failed to load recipes");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleAdded(recipe: Recipe) {
    setRecipes((prev) => [recipe, ...prev]);
    setAddOpen(false);
  }

  function handleUpdated(recipe: Recipe) {
    setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? recipe : r)));
    setSelected(recipe);
  }

  function handleDeleted(id: number) {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    if (selected?.id === id) setDetailOpen(false);
  }

  async function handleLogAsFood(recipe: Recipe) {
    const today = new Date().toISOString().split("T")[0];
    await fetch("/api/food-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logged_at: today,
        food_name: recipe.name,
        serving_size: "1 serving",
        calories: recipe.calories,
        protein_g: recipe.protein_g,
        carbs_g: recipe.carbs_g,
        fat_g: recipe.fat_g,
        fiber_g: recipe.fiber_g,
        source: "recipe",
        recipe_id: recipe.id,
      }),
    });
    setDetailOpen(false);
    setLogSuccess(`"${recipe.name}" logged to today's food diary!`);
    setTimeout(() => setLogSuccess(""), 4000);
  }

  async function handleAddToGrocery(recipe: Recipe) {
    const res = await fetch("/api/grocery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: recipe.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error ?? "Failed to add recipe ingredients to grocery list.");
      return;
    }
    const count = Array.isArray(data) ? data.length : 0;
    setDetailOpen(false);
    setGrocerySuccess(`Added ${count} ingredient${count === 1 ? "" : "s"} from "${recipe.name}" to Grocery.`);
    setTimeout(() => setGrocerySuccess(""), 4000);
  }

  const allTags = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => r.tags?.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [recipes]);

  const filtered = useMemo(() => {
    let list = recipes.filter((r) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.tags?.some((t) => t.toLowerCase().includes(q));
      const matchesTag = !activeTag || r.tags?.includes(activeTag);
      return matchesSearch && matchesTag;
    });

    switch (sort) {
      case "name":
        list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "cal-asc":
        list = [...list].sort((a, b) => Number(a.calories) - Number(b.calories));
        break;
      case "cal-desc":
        list = [...list].sort((a, b) => Number(b.calories) - Number(a.calories));
        break;
      case "protein-desc":
        list = [...list].sort((a, b) => Number(b.protein_g) - Number(a.protein_g));
        break;
    }
    return list;
  }, [recipes, search, activeTag, sort]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Recipes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {recipes.length > 0
              ? `${recipes.length} recipe${recipes.length !== 1 ? "s" : ""} in your library`
              : "Your personal recipe library."}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant={importOpen ? "default" : "outline"}
            size="sm"
            onClick={() => { setImportOpen((v) => !v); setExploreOpen(false); }}
            className="gap-1.5"
          >
            <Link2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button
            variant={exploreOpen ? "default" : "outline"}
            size="sm"
            onClick={() => { setExploreOpen((v) => !v); setImportOpen(false); }}
            className="gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Explore</span>
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add Recipe</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Recipe</DialogTitle>
              </DialogHeader>
              <RecipeForm onSaved={handleAdded} onCancel={() => setAddOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* URL Importer */}
      {importOpen && (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Import Recipe from URL</p>
            <button onClick={() => setImportOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <RecipeImporter onSaved={(r) => { handleAdded(r); setImportOpen(false); }} />
        </div>
      )}

      {/* AI Explorer */}
      {exploreOpen && (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Explore Recipes with AI</p>
            <button onClick={() => setExploreOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <RecipeExplorer onSaved={(r) => { handleAdded(r); }} />
        </div>
      )}

      {logSuccess && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-800 dark:text-green-200 font-medium">
          {logSuccess}
        </div>
      )}
      {grocerySuccess && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium">
          {grocerySuccess}
        </div>
      )}

      {/* Search + Sort */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recipes or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-36 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tag filter row */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((tag) => (
            <Badge
              key={tag}
              variant={activeTag === tag ? "default" : "secondary"}
              className="cursor-pointer select-none text-xs gap-1"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            >
              {tag}
              {activeTag === tag && <X className="h-2.5 w-2.5" />}
            </Badge>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {loadError}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <ChefHat className="h-14 w-14 opacity-20 mb-4" />
          {recipes.length === 0 ? (
            <>
              <p className="font-medium">No recipes yet</p>
              <p className="text-sm mt-1">Add your first or explore with AI above.</p>
            </>
          ) : (
            <>
              <p className="font-medium">No matches</p>
              <button
                className="text-sm mt-1 underline text-muted-foreground"
                onClick={() => { setSearch(""); setActiveTag(null); }}
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {(search || activeTag) && (
            <p className="text-xs text-muted-foreground -mb-1">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              {activeTag && <> · <strong>{activeTag}</strong></>}
            </p>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onClick={() => { setSelected(recipe); setDetailOpen(true); }}
                onDeleted={handleDeleted}
                onPhotoUpdated={handleUpdated}
              />
            ))}
          </div>
        </>
      )}

      <RecipeDetail
        recipe={selected}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
        onLogAsFood={handleLogAsFood}
        onAddToGrocery={handleAddToGrocery}
      />
    </div>
  );
}
