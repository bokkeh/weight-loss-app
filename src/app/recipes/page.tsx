"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Recipe } from "@/types";
import { Search, Plus, ChefHat } from "lucide-react";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [logSuccess, setLogSuccess] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/recipes");
        setRecipes(await res.json());
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
  }

  async function handleLogAsFood(recipe: Recipe) {
    const today = new Date().toISOString().split("T")[0];
    await fetch("/api/food-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logged_at: today,
        food_name: recipe.name,
        serving_size: `1 serving`,
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

  const filtered = recipes.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.tags?.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recipes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your personal recipe library with macro data.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Add Recipe
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

      {logSuccess && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-800 dark:text-green-200 font-medium">
          {logSuccess}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search recipes or tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <ChefHat className="h-14 w-14 opacity-20 mb-4" />
          {recipes.length === 0 ? (
            <>
              <p className="font-medium">No recipes yet</p>
              <p className="text-sm mt-1">Add your first recipe to get started.</p>
            </>
          ) : (
            <>
              <p className="font-medium">No recipes match your search</p>
              <p className="text-sm mt-1">Try different keywords or tags.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onClick={() => {
                setSelected(recipe);
                setDetailOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <RecipeDetail
        recipe={selected}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
        onLogAsFood={handleLogAsFood}
      />
    </div>
  );
}
