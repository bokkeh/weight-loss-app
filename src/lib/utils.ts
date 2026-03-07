import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Returns YYYY-MM-DD in the user's LOCAL timezone (not UTC). */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Normalizes food labels to Title Case (e.g. "chai latte" -> "Chai Latte"). */
export function formatFoodName(value: string): string {
  const compact = value.trim().replace(/\s+/g, " ");
  if (!compact) return "";
  return compact
    .toLowerCase()
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((segment) => (segment ? segment[0].toUpperCase() + segment.slice(1) : segment))
        .join("-")
    )
    .join(" ");
}
