import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";

export async function GET(req: Request) {
  const authState = await requireUserId();
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const weeks = parseInt(searchParams.get("weeks") ?? "1", 10);

  try {
    let entries;
    if (date) {
      entries = await sql`
        SELECT id, logged_at::text, meal_type, food_name, serving_size,
               calories::float, protein_g::float, carbs_g::float,
               fat_g::float, fiber_g::float, sodium_mg::float, source, recipe_id, created_at::text
        FROM food_log_entries
        WHERE user_id = ${userId}
          AND logged_at = ${date}
        ORDER BY created_at ASC
      `;
    } else {
      entries = await sql`
        SELECT id, logged_at::text, meal_type, food_name, serving_size,
               calories::float, protein_g::float, carbs_g::float,
               fat_g::float, fiber_g::float, sodium_mg::float, source, recipe_id, created_at::text
        FROM food_log_entries
        WHERE user_id = ${userId}
          AND logged_at >= CURRENT_DATE - (${weeks} * INTERVAL '1 week')
        ORDER BY logged_at DESC, created_at ASC
      `;
    }
    return NextResponse.json(entries);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authState = await requireUserId();
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    const body = await req.json();
    const {
      logged_at,
      meal_type,
      food_name,
      serving_size,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      fiber_g,
      sodium_mg,
      source = "manual",
      recipe_id,
    } = body;

    if (!food_name) {
      return NextResponse.json({ error: "food_name is required" }, { status: 400 });
    }

    const [entry] = await sql`
      INSERT INTO food_log_entries
        (user_id, logged_at, meal_type, food_name, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, source, recipe_id)
      VALUES (
        ${userId},
        ${logged_at ?? new Date().toISOString().split("T")[0]},
        ${meal_type ?? null},
        ${food_name},
        ${serving_size ?? null},
        ${Number(calories) || 0},
        ${Number(protein_g) || 0},
        ${Number(carbs_g) || 0},
        ${Number(fat_g) || 0},
        ${Number(fiber_g) || 0},
        ${Number(sodium_mg) || 0},
        ${source},
        ${recipe_id ?? null}
      )
      RETURNING id, logged_at::text, meal_type, food_name, serving_size,
                calories::float, protein_g::float, carbs_g::float,
                fat_g::float, fiber_g::float, sodium_mg::float, source, recipe_id, created_at::text
    `;

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
