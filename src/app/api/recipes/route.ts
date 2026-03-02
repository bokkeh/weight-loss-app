import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tag = searchParams.get("tag");

  try {
    let recipes;
    if (tag) {
      recipes = await sql`
        SELECT id, name, description, servings,
               calories::float, protein_g::float, carbs_g::float, fat_g::float, fiber_g::float,
               ingredients, instructions, image_url, tags, created_at::text, updated_at::text
        FROM recipes
        WHERE ${tag} = ANY(tags)
        ORDER BY created_at DESC
      `;
    } else {
      recipes = await sql`
        SELECT id, name, description, servings,
               calories::float, protein_g::float, carbs_g::float, fat_g::float, fiber_g::float,
               ingredients, instructions, image_url, tags, created_at::text, updated_at::text
        FROM recipes
        ORDER BY created_at DESC
      `;
    }
    return NextResponse.json(recipes);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      description,
      servings = 1,
      calories = 0,
      protein_g = 0,
      carbs_g = 0,
      fat_g = 0,
      fiber_g = 0,
      ingredients,
      instructions,
      tags = [],
    } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const [recipe] = await sql`
      INSERT INTO recipes
        (name, description, servings, calories, protein_g, carbs_g, fat_g, fiber_g, ingredients, instructions, tags)
      VALUES (
        ${name},
        ${description ?? null},
        ${Number(servings)},
        ${Number(calories)},
        ${Number(protein_g)},
        ${Number(carbs_g)},
        ${Number(fat_g)},
        ${Number(fiber_g)},
        ${ingredients ?? null},
        ${instructions ?? null},
        ${tags}
      )
      RETURNING id, name, description, servings,
                calories::float, protein_g::float, carbs_g::float, fat_g::float, fiber_g::float,
                ingredients, instructions, image_url, tags, created_at::text, updated_at::text
    `;

    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
