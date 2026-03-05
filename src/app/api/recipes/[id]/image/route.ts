import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { uploadRecipeImage, deleteRecipeImage } from "@/lib/blob";
import { requireUserId } from "@/lib/route-auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const recipeId = Number(id);
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    const [existing] = await sql`
      SELECT image_url
      FROM recipes
      WHERE id = ${recipeId}
        AND user_id = ${userId}
    `;
    if (!existing) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    if (existing.image_url) {
      await deleteRecipeImage(existing.image_url as string);
    }

    const imageUrl = await uploadRecipeImage(recipeId, file);

    await sql`
      UPDATE recipes
      SET image_url = ${imageUrl}
      WHERE id = ${recipeId}
        AND user_id = ${userId}
    `;

    return NextResponse.json({ image_url: imageUrl });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
