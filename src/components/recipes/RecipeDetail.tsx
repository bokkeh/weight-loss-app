"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RecipeForm } from "./RecipeForm";
import { Recipe } from "@/types";
import { Pencil, Trash2, UtensilsCrossed } from "lucide-react";

interface Props {
  recipe: Recipe | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (r: Recipe) => void;
  onDeleted: (id: number) => void;
  onLogAsFood: (r: Recipe) => void;
}

export function RecipeDetail({
  recipe,
  open,
  onClose,
  onUpdated,
  onDeleted,
  onLogAsFood,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!recipe) return null;

  async function handleDelete() {
    if (!confirm(`Delete "${recipe!.name}"?`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/recipes/${recipe!.id}`, { method: "DELETE" });
      onDeleted(recipe!.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="overflow-y-auto w-full sm:max-w-lg px-6">
          <SheetHeader>
            <SheetTitle>Edit Recipe</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <RecipeForm
              initial={recipe}
              onSaved={(r) => {
                onUpdated(r);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-xl">{recipe.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-6 pb-6">
          {recipe.image_url && (
            <div className="relative h-52 -mx-6 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={recipe.image_url}
                alt={recipe.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {recipe.description && (
            <p className="text-sm text-muted-foreground">{recipe.description}</p>
          )}

          {recipe.tags && recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recipe.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Per serving ({recipe.servings} total serving{recipe.servings !== 1 ? "s" : ""})
            </p>
            <div className="grid grid-cols-5 gap-2 text-center">
              {[
                { label: "Cal", value: `${Number(recipe.calories).toFixed(0)}`, color: "text-orange-600" },
                { label: "Protein", value: `${Number(recipe.protein_g).toFixed(1)}g`, color: "text-blue-600" },
                { label: "Carbs", value: `${Number(recipe.carbs_g).toFixed(1)}g`, color: "text-yellow-600" },
                { label: "Fat", value: `${Number(recipe.fat_g).toFixed(1)}g`, color: "text-red-600" },
                { label: "Fiber", value: `${Number(recipe.fiber_g).toFixed(1)}g`, color: "text-green-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-muted rounded-lg p-2">
                  <p className={`font-bold text-sm font-mono ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {recipe.ingredients && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Ingredients</h3>
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                  {recipe.ingredients}
                </p>
              </div>
            </>
          )}

          {recipe.instructions && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Instructions</h3>
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                  {recipe.instructions}
                </p>
              </div>
            </>
          )}

          <Separator />

          <div className="flex flex-col gap-2 pb-4">
            <Button
              variant="outline"
              onClick={() => onLogAsFood(recipe)}
              className="w-full"
            >
              <UtensilsCrossed className="h-4 w-4 mr-2" />
              Log as Food
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditing(true)}
                className="flex-1"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
