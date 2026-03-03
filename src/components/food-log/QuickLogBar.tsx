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
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
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
  const [image, setImage] = useState<ImageData | null>(null);
  const [preview, setPreview] = useState<null | {
    food_name: string;
    serving_size?: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const data = await resizeImage(file);
      setImage(data);
      setError("");
    } catch {
      setError("Failed to load image");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && !image) return;
    setLoading(true);
    setError("");
    setPreview(null);

    try {
      const body = image
        ? { imageBase64: image.base64, mimeType: image.mimeType, text: text.trim() || undefined, logged_at: date }
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
      setImage(null);
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
          {/* Image preview strip */}
          {image && (
            <div className="flex items-center gap-2 px-3 pt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.preview} alt="food" className="h-10 w-10 rounded-md object-cover shrink-0" />
              <span className="text-xs text-muted-foreground flex-1 truncate">Image ready — add a description or just hit Log</span>
              <button
                type="button"
                onClick={() => setImage(null)}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2 px-2 py-1.5">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
              <Input
                className="pl-9 border-0 shadow-none focus-visible:ring-0 bg-transparent"
                placeholder={image ? 'Optional: describe portion or context...' : 'e.g. "chicken breast 4oz" or "2 scrambled eggs"'}
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
              className="hidden"
              onChange={handleImageSelect}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="shrink-0 my-0.5 flex items-center justify-center h-8 w-8 rounded-md text-violet-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950 transition-colors disabled:opacity-40"
              title="Upload food photo"
            >
              <Camera className="h-4 w-4" />
            </button>
            <Button type="submit" disabled={loading || (!text.trim() && !image)} size="sm" className="shrink-0 my-0.5">
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
          </span>
        </div>
      )}
    </div>
  );
}
