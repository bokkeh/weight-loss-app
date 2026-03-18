"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, Camera, X } from "lucide-react";
import { FoodLogEntry } from "@/types";

interface Props {
  date: string;
  onAdded: (entry: FoodLogEntry) => void;
}

interface ImageData {
  base64: string;
  mimeType: string;
  preview: string;
}

const MAX_IMAGES = 5;

function resizeImage(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg", preview: dataUrl });
      };
      img.src = ev.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function QuickLogBar({ date, onAdded }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<ImageData[]>([]);
  const [preview, setPreview] = useState<null | {
    food_name: string;
    serving_size?: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
  }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";
    try {
      const remainingSlots = MAX_IMAGES - images.length;
      if (remainingSlots <= 0) {
        setError(`You can upload up to ${MAX_IMAGES} photos.`);
        return;
      }
      const selected = files.slice(0, remainingSlots);
      const resized = await Promise.all(selected.map((file) => resizeImage(file)));
      setImages((prev) => [...prev, ...resized]);
      setError("");
    } catch {
      setError("Failed to load image");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && images.length === 0) return;
    setLoading(true);
    setError("");
    setPreview(null);

    try {
      const body =
        images.length > 0
          ? {
              images: images.map((img) => ({ imageBase64: img.base64, mimeType: img.mimeType })),
              text: text.trim() || undefined,
              logged_at: date,
            }
          : { text: text.trim(), logged_at: date };

      const res = await fetch("/api/food-log/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to estimate macros");
      }

      const { entry, macros } = await res.json();
      setPreview(macros);
      onAdded(entry);
      setText("");
      setImages([]);
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
        <div className="bg-background rounded-[10px]">
          {images.length > 0 && (
            <div className="flex items-center gap-2 px-3 pt-2">
              <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto pb-1">
                {images.map((image, index) => (
                  <div key={index} className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.preview} alt={`food-${index + 1}`} className="h-10 w-10 rounded-md object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-background border text-muted-foreground hover:text-foreground flex items-center justify-center"
                      aria-label={`Remove photo ${index + 1}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{images.length}/{MAX_IMAGES}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2 px-2 py-1.5">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
              <Input
                className="pl-9 border-0 shadow-none focus-visible:ring-0 bg-transparent"
                placeholder={images.length > 0 ? "Optional: describe portion or context..." : 'e.g. "chicken breast 4oz" or "2 scrambled eggs"'}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError("");
                }}
                disabled={loading}
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="shrink-0 my-0.5 flex items-center justify-center h-8 w-8 rounded-md text-violet-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950 transition-colors disabled:opacity-40"
              title="Upload food photo(s)"
            >
              <Camera className="h-4 w-4" />
            </button>
            <Button type="submit" disabled={loading || (!text.trim() && images.length === 0)} size="sm" className="shrink-0 my-0.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log"}
            </Button>
          </form>
        </div>
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
            <span><strong>{Number(preview.sugar_g ?? 0).toFixed(1)}g</strong> sugar</span>
          </span>
        </div>
      )}
    </div>
  );
}
