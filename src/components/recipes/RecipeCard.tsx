"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Recipe } from "@/types";
import { shareOrCopy } from "@/lib/shareUtils";
import { ImageOff, Camera, Trash2, Upload, Link, Share2, Check, Sparkles, Loader2 } from "lucide-react";

interface Props {
  recipe: Recipe;
  onClick: () => void;
  onDeleted: (id: number) => void;
  onPhotoUpdated: (recipe: Recipe) => void;
}

export function RecipeCard({ recipe, onClick, onDeleted, onPhotoUpdated }: Props) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoMode, setPhotoMode] = useState<"file" | "url">("url");
  const [photoUrl, setPhotoUrl] = useState(recipe.image_url ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(recipe.image_url ?? null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [shareDone, setShareDone] = useState(false);

  function stopProp(e: React.MouseEvent) {
    e.stopPropagation();
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${recipe.name}"?`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/recipes/${recipe.id}`, { method: "DELETE" });
      onDeleted(recipe.id);
    } finally {
      setDeleting(false);
    }
  }

  function openPhoto(e: React.MouseEvent) {
    e.stopPropagation();
    setPhotoMode(recipe.image_url ? "url" : "file");
    setPhotoUrl(recipe.image_url ?? "");
    setPhotoPreview(recipe.image_url ?? null);
    setPhotoFile(null);
    setPhotoOpen(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSavePhoto() {
    setSaving(true);
    try {
      if (photoMode === "url" && photoUrl.trim()) {
        const res = await fetch(`/api/recipes/${recipe.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: photoUrl.trim() }),
        });
        if (!res.ok) throw new Error(await res.text());
        const updated: Recipe = await res.json();
        onPhotoUpdated(updated);
      } else if (photoMode === "file" && photoFile) {
        const fd = new FormData();
        fd.append("image", photoFile);
        const res = await fetch(`/api/recipes/${recipe.id}/image`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error(await res.text());
        const { image_url } = await res.json();
        onPhotoUpdated({ ...recipe, image_url });
      }
      setPhotoOpen(false);
    } catch (err) {
      alert(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleGeneratePhoto() {
    setGenerating(true);
    try {
      const res = await fetch("/api/recipes/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: recipe.name,
          description: recipe.description ?? "",
          ingredients: recipe.ingredients ?? "",
          instructions: recipe.instructions ?? "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Image generation failed (${res.status})`);

      const imageDataUrl = typeof data.imageDataUrl === "string" ? data.imageDataUrl : null;
      if (!imageDataUrl) throw new Error("No image returned from AI generation.");

      const blob = await fetch(imageDataUrl).then((r) => r.blob());
      const ext = blob.type.includes("jpeg") ? "jpg" : "png";
      const file = new File([blob], `recipe-generated-${recipe.id}-${Date.now()}.${ext}`, {
        type: blob.type || "image/png",
      });

      setPhotoMode("file");
      setPhotoFile(file);
      setPhotoUrl("");
      setPhotoPreview(imageDataUrl);
    } catch (err) {
      alert(String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleShare(e: React.MouseEvent) {
    e.stopPropagation();

    const shareText = [
      recipe.name,
      `Calories: ${Number(recipe.calories).toFixed(0)} kcal`,
      `Protein: ${Number(recipe.protein_g).toFixed(1)}g`,
      `Carbs: ${Number(recipe.carbs_g).toFixed(1)}g`,
      `Fat: ${Number(recipe.fat_g).toFixed(1)}g`,
      recipe.tags?.length ? `Tags: ${recipe.tags.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await shareOrCopy(shareText, recipe.name);
      setShareDone(true);
      setTimeout(() => setShareDone(false), 2000);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Failed to share recipe:", err);
    }
  }

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden group py-0 gap-0"
        onClick={onClick}
      >
        <div className="relative h-40 bg-muted">
          {recipe.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.image_url}
              alt={recipe.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <ImageOff className="h-8 w-8 opacity-30" />
            </div>
          )}

          {/* Hover action buttons */}
          <div className="absolute inset-0 flex items-start justify-end gap-1.5 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleShare}
              className="bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
              title="Share recipe"
            >
              {shareDone ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={openPhoto}
              className="bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
              title="Edit photo"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600/80 hover:bg-red-600 text-white rounded-full p-1.5 transition-colors"
              title="Delete recipe"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <CardContent className="p-3">
          <h3 className="font-semibold text-sm leading-tight mb-1 line-clamp-2">
            {recipe.name}
          </h3>
          <div className="flex gap-2 text-xs font-mono mb-2">
            <span className="text-orange-600 font-bold">
              {Number(recipe.calories).toFixed(0)} kcal
            </span>
            <span className="text-blue-600">P: {Number(recipe.protein_g).toFixed(0)}g</span>
            <span className="text-yellow-600">C: {Number(recipe.carbs_g).toFixed(0)}g</span>
          </div>
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recipe.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo edit dialog */}
      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent className="max-w-sm" onClick={stopProp}>
          <DialogHeader>
            <DialogTitle>Edit Photo</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Mode toggle */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
              <button
                type="button"
                onClick={() => { setPhotoMode("url"); setPhotoFile(null); }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-md transition-colors ${
                  photoMode === "url"
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Link className="h-3 w-3" /> Paste URL
              </button>
              <button
                type="button"
                onClick={() => { setPhotoMode("file"); setPhotoUrl(""); setPhotoPreview(null); }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-md transition-colors ${
                  photoMode === "file"
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Upload className="h-3 w-3" /> Upload File
              </button>
              <button
                type="button"
                onClick={handleGeneratePhoto}
                disabled={generating}
                className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-md transition-colors text-muted-foreground hover:text-foreground disabled:opacity-60"
                title="Generate image with AI"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Generating
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" /> Generate AI
                  </>
                )}
              </button>
            </div>

            {photoMode === "url" ? (
              <Input
                placeholder="https://example.com/photo.jpg"
                value={photoUrl}
                onChange={(e) => {
                  setPhotoUrl(e.target.value);
                  setPhotoPreview(e.target.value || null);
                }}
              />
            ) : (
              <Input type="file" accept="image/*" onChange={handleFileChange} />
            )}

            {photoPreview && (
              <div className="w-full h-40 rounded-lg overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleSavePhoto}
              disabled={saving || (photoMode === "url" ? !photoUrl.trim() : !photoFile)}
            >
              {saving ? "Saving..." : "Save Photo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
