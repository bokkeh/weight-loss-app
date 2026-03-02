import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { deleteRecipeImage } from "@/lib/blob";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const [recipe] = await sql`
      SELECT id, name, description, servings,
             calories::float, protein_g::float, carbs_g::float, fat_g::float, fiber_g::float,
             ingredients, instructions, image_url, tags, created_at::text, updated_at::text
      FROM recipes
      WHERE id = ${Number(id)}
    `;
    if (!recipe) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(recipe);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const {
      name,
      description,
      servings,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      fiber_g,
      ingredients,
      instructions,
      tags,
      image_url,
    } = body;

    const [recipe] = await sql`
      UPDATE recipes SET
        name         = COALESCE(${name ?? null}, name),
        description  = COALESCE(${description ?? null}, description),
        servings     = COALESCE(${servings != null ? Number(servings) : null}, servings),
        calories     = COALESCE(${calories != null ? Number(calories) : null}, calories),
        protein_g    = COALESCE(${protein_g != null ? Number(protein_g) : null}, protein_g),
        carbs_g      = COALESCE(${carbs_g != null ? Number(carbs_g) : null}, carbs_g),
        fat_g        = COALESCE(${fat_g != null ? Number(fat_g) : null}, fat_g),
        fiber_g      = COALESCE(${fiber_g != null ? Number(fiber_g) : null}, fiber_g),
        ingredients  = COALESCE(${ingredients ?? null}, ingredients),
        instructions = COALESCE(${instructions ?? null}, instructions),
        image_url    = COALESCE(${image_url ?? null}, image_url),
        tags         = COALESCE(${tags ?? null}, tags)
      WHERE id = ${Number(id)}
      RETURNING id, name, description, servings,
                calories::float, protein_g::float, carbs_g::float, fat_g::float, fiber_g::float,
                ingredients, instructions, image_url, tags, created_at::text, updated_at::text
    `;

    if (!recipe) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(recipe);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const [existing] = await sql`
      SELECT image_url FROM recipes WHERE id = ${Number(id)}
    `;
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (existing.image_url) {
      await deleteRecipeImage(existing.image_url as string);
    }

    await sql`DELETE FROM recipes WHERE id = ${Number(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
