import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { handleApiError, notFound, parseJsonBody } from "@/lib/api";
import { requireUserId } from "@/lib/route-auth";
import { formatFoodName } from "@/lib/utils";
import { deleteByIdSchema, updateFoodLogSchema } from "@/lib/validation";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    const body = await parseJsonBody(req, updateFoodLogSchema);
    const { id: targetId } = deleteByIdSchema.parse({ id });
    const [existing] = await sql`
      SELECT id, logged_at::text, meal_type, display_order::float, food_name, serving_size,
             calories::float, protein_g::float, carbs_g::float, fat_g::float, fiber_g::float, sugar_g::float, sodium_mg::float,
             source, recipe_id, created_at::text
      FROM food_log_entries
      WHERE id = ${targetId}
        AND user_id = ${userId}
      LIMIT 1
    `;
    if (!existing) return notFound();

    const nextFoodName = body.food_name
      ? formatFoodName(body.food_name)
      : formatFoodName(String(existing.food_name));
    if (!nextFoodName) {
      return NextResponse.json({ error: "food_name is required" }, { status: 400 });
    }

    const nextServing = body.serving_size !== undefined ? body.serving_size : existing.serving_size;
    const nextMealType = body.meal_type !== undefined ? body.meal_type : existing.meal_type;
    const nextOrder = body.display_order !== undefined ? body.display_order : existing.display_order;
    const nextCalories = body.calories ?? Number(existing.calories);
    const nextProtein = body.protein_g ?? Number(existing.protein_g);
    const nextCarbs = body.carbs_g ?? Number(existing.carbs_g);
    const nextFat = body.fat_g ?? Number(existing.fat_g);
    const nextFiber = body.fiber_g ?? Number(existing.fiber_g);
    const nextSugar = body.sugar_g ?? Number(existing.sugar_g ?? 0);
    const nextSodium = body.sodium_mg ?? Number(existing.sodium_mg);

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
          sugar_g    = ${nextSugar},
          sodium_mg  = ${nextSodium}
      WHERE id = ${targetId}
        AND user_id = ${userId}
      RETURNING id, logged_at::text, meal_type, display_order::float, food_name, serving_size,
                calories::float, protein_g::float, carbs_g::float, fat_g::float,
                fiber_g::float, sugar_g::float, sodium_mg::float, source, recipe_id, created_at::text
    `;
    if (!entry) return notFound();
    return NextResponse.json(entry);
  } catch (error) {
    return handleApiError(error, "Failed to update food log entry");
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
    const { id: targetId } = deleteByIdSchema.parse({ id });
    const [deleted] = await sql`
      DELETE FROM food_log_entries
      WHERE id = ${targetId}
        AND user_id = ${userId}
      RETURNING id
    `;
    if (!deleted) {
      return notFound();
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Failed to delete food log entry");
  }
}
