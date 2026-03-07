import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";
import { formatFoodName } from "@/lib/utils";

async function ensureFoodLogColumns() {
  await sql`
    ALTER TABLE food_log_entries
    ADD COLUMN IF NOT EXISTS display_order NUMERIC(12,2)
  `;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    await ensureFoodLogColumns();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const targetId = Number(id);
    const [existing] = await sql`
      SELECT id, logged_at::text, meal_type, display_order::float, food_name, serving_size,
             calories::float, protein_g::float, carbs_g::float, fat_g::float, fiber_g::float, sodium_mg::float,
             source, recipe_id, created_at::text
      FROM food_log_entries
      WHERE id = ${targetId}
        AND user_id = ${userId}
      LIMIT 1
    `;
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
    const nextFoodName = has("food_name")
      ? formatFoodName(String(body.food_name ?? ""))
      : formatFoodName(String(existing.food_name));
    if (!nextFoodName) {
      return NextResponse.json({ error: "food_name is required" }, { status: 400 });
    }

    const nextServing = has("serving_size") ? (body.serving_size ? String(body.serving_size) : null) : existing.serving_size;
    const nextMealType = has("meal_type") ? (body.meal_type ? String(body.meal_type) : null) : existing.meal_type;
    const nextOrder = has("display_order")
      ? (body.display_order == null ? null : Number(body.display_order))
      : existing.display_order;
    const nextCalories = has("calories") ? Number(body.calories ?? 0) : Number(existing.calories);
    const nextProtein = has("protein_g") ? Number(body.protein_g ?? 0) : Number(existing.protein_g);
    const nextCarbs = has("carbs_g") ? Number(body.carbs_g ?? 0) : Number(existing.carbs_g);
    const nextFat = has("fat_g") ? Number(body.fat_g ?? 0) : Number(existing.fat_g);
    const nextFiber = has("fiber_g") ? Number(body.fiber_g ?? 0) : Number(existing.fiber_g);
    const nextSodium = has("sodium_mg") ? Number(body.sodium_mg ?? 0) : Number(existing.sodium_mg);

    const [entry] = await sql`
      UPDATE food_log_entries
      SET food_name  = ${nextFoodName},
          serving_size = ${nextServing},
          meal_type  = ${nextMealType},
          display_order = ${nextOrder},
          calories   = ${nextCalories},
          protein_g  = ${nextProtein},
          carbs_g    = ${nextCarbs},
          fat_g      = ${nextFat},
          fiber_g    = ${nextFiber},
          sodium_mg  = ${nextSodium}
      WHERE id = ${targetId}
        AND user_id = ${userId}
      RETURNING id, logged_at::text, meal_type, display_order::float, food_name, serving_size,
                calories::float, protein_g::float, carbs_g::float, fat_g::float,
                fiber_g::float, sodium_mg::float, source, recipe_id, created_at::text
    `;
    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(entry);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authState = await requireUserId(_req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    const [deleted] = await sql`
      DELETE FROM food_log_entries
      WHERE id = ${Number(id)}
        AND user_id = ${userId}
      RETURNING id
    `;
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
