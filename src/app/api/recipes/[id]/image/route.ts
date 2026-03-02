import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { uploadRecipeImage, deleteRecipeImage } from "@/lib/blob";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const recipeId = Number(id);

  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    const [existing] = await sql`
      SELECT image_url FROM recipes WHERE id = ${recipeId}
    `;
    if (!existing) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    if (existing.image_url) {
      await deleteRecipeImage(existing.image_url as string);
    }

    const imageUrl = await uploadRecipeImage(recipeId, file);

    await sql`
      UPDATE recipes SET image_url = ${imageUrl} WHERE id = ${recipeId}
    `;

    return NextResponse.json({ image_url: imageUrl });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
