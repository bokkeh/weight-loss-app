"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Recipe } from "@/types";

interface Props {
  initial?: Partial<Recipe>;
  onSaved: (recipe: Recipe) => void;
  onCancel?: () => void;
}

export function RecipeForm({ initial, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    servings: String(initial?.servings ?? 1),
    calories: String(initial?.calories ?? ""),
    protein_g: String(initial?.protein_g ?? ""),
    carbs_g: String(initial?.carbs_g ?? ""),
    fat_g: String(initial?.fat_g ?? ""),
    fiber_g: String(initial?.fiber_g ?? ""),
    ingredients: initial?.ingredients ?? "",
    instructions: initial?.instructions ?? "",
  });
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    initial?.image_url ?? null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addTag(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const t = tagInput.trim().toLowerCase();
      if (t && !tags.includes(t)) {
        setTags((prev) => [...prev, t]);
      }
      setTagInput("");
    }
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    setLoading(true);
    setError("");

    try {
      const payload = {
        ...form,
        servings: Number(form.servings) || 1,
        calories: parseFloat(form.calories) || 0,
        protein_g: parseFloat(form.protein_g) || 0,
        carbs_g: parseFloat(form.carbs_g) || 0,
        fat_g: parseFloat(form.fat_g) || 0,
        fiber_g: parseFloat(form.fiber_g) || 0,
        tags,
      };

      let recipe: Recipe;

      if (initial?.id) {
        const res = await fetch(`/api/recipes/${initial.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        recipe = await res.json();
      } else {
        const res = await fetch("/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        recipe = await res.json();
      }

      if (imageFile) {
        const fd = new FormData();
        fd.append("image", imageFile);
        const imgRes = await fetch(`/api/recipes/${recipe.id}/image`, {
          method: "POST",
          body: fd,
        });
        if (imgRes.ok) {
          const { image_url } = await imgRes.json();
          recipe = { ...recipe, image_url };
        } else {
          const err = await imgRes.json().catch(() => ({}));
          throw new Error(`Image upload failed: ${err.error ?? imgRes.statusText}`);
        }
      }

      onSaved(recipe);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="r-name">Recipe Name</Label>
        <Input
          id="r-name"
          placeholder="e.g. High-Protein Chicken Bowl"
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="r-desc">Description</Label>
        <Textarea
          id="r-desc"
          placeholder="Brief description..."
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          rows={2}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="r-servings">Servings</Label>
          <Input
            id="r-servings"
            type="number"
            min="1"
            value={form.servings}
            onChange={(e) => setField("servings", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-cal">Calories/serving</Label>
          <Input
            id="r-cal"
            type="number"
            min="0"
            placeholder="kcal"
            value={form.calories}
            onChange={(e) => setField("calories", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-protein">Protein (g)</Label>
          <Input
            id="r-protein"
            type="number"
            min="0"
            step="0.1"
            placeholder="g"
            value={form.protein_g}
            onChange={(e) => setField("protein_g", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-carbs">Carbs (g)</Label>
          <Input
            id="r-carbs"
            type="number"
            min="0"
            step="0.1"
            placeholder="g"
            value={form.carbs_g}
            onChange={(e) => setField("carbs_g", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-fat">Fat (g)</Label>
          <Input
            id="r-fat"
            type="number"
            min="0"
            step="0.1"
            placeholder="g"
            value={form.fat_g}
            onChange={(e) => setField("fat_g", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-fiber">Fiber (g)</Label>
          <Input
            id="r-fiber"
            type="number"
            min="0"
            step="0.1"
            placeholder="g"
            value={form.fiber_g}
            onChange={(e) => setField("fiber_g", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="r-ingredients">Ingredients</Label>
        <Textarea
          id="r-ingredients"
          placeholder="List each ingredient on a new line..."
          value={form.ingredients}
          onChange={(e) => setField("ingredients", e.target.value)}
          rows={4}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="r-instructions">Instructions</Label>
        <Textarea
          id="r-instructions"
          placeholder="Step-by-step cooking instructions..."
          value={form.instructions}
          onChange={(e) => setField("instructions", e.target.value)}
          rows={4}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="r-tags">Tags (press Enter to add)</Label>
        <Input
          id="r-tags"
          placeholder="e.g. high-protein, low-carb"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={addTag}
        />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="r-image">Recipe Photo</Label>
        <Input
          id="r-image"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
        />
        {imagePreview && (
          <div className="mt-2 relative w-full h-40 rounded-lg overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="Recipe preview"
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Saving..." : initial?.id ? "Update Recipe" : "Save Recipe"}
        </Button>
      </div>
    </form>
  );
}
