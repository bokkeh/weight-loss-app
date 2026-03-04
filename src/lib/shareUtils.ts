export async function shareOrCopy(text: string, title?: string): Promise<"shared" | "copied"> {
  if (typeof navigator !== "undefined" && navigator.share) {
    await navigator.share({ title: title ?? "Health Summary", text });
    return "shared";
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}
