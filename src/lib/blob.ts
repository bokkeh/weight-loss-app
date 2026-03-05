import { put, del } from "@vercel/blob";

export async function uploadRecipeImage(
  recipeId: number,
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `recipes/${recipeId}/${Date.now()}.${ext}`;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  const { url } = await put(filename, file, { access: "public", token });
  return url;
}

export async function deleteRecipeImage(url: string): Promise<void> {
  try {
    await del(url);
  } catch {
    // silently fail if image already deleted
  }
}

export async function uploadProfileImage(
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `profiles/default/${Date.now()}.${ext}`;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  const { url } = await put(filename, file, { access: "public", token });
  return url;
}

export async function deleteProfileImage(url: string): Promise<void> {
  try {
    await del(url);
  } catch {
    // silently fail if image already deleted
  }
}
