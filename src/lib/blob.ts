import { put, del } from "@vercel/blob";

export async function uploadRecipeImage(
  recipeId: number,
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `recipes/${recipeId}/${Date.now()}.${ext}`;
  const { url } = await put(filename, file, { access: "public" });
  return url;
}

export async function deleteRecipeImage(url: string): Promise<void> {
  try {
    await del(url);
  } catch {
    // silently fail if image already deleted
  }
}
