import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { handleApiError, parseJsonBody } from "@/lib/api";
import { requireUserId } from "@/lib/route-auth";
import { formatFoodName, localDateStr } from "@/lib/utils";
import { createFoodLogSchema, isoDateSchema } from "@/lib/validation";

export async function GET(req: Request) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    const { searchParams } = new URL(req.url);
    const rawDate = searchParams.get("date");
    const rawWeeks = searchParams.get("weeks");
    const date = rawDate ? isoDateSchema.parse(rawDate) : null;
    const weeks = rawWeeks ? Math.min(520, Math.max(1, Number.parseInt(rawWeeks, 10) || 1)) : 1;

    let entries;
    if (date) {
      entries = await sql`
        SELECT id, logged_at::text, meal_type, display_order::float, food_name, serving_size,
               calories::float, protein_g::float, carbs_g::float,
               fat_g::float, fiber_g::float, sugar_g::float, sodium_mg::float, source, recipe_id, created_at::text
        FROM food_log_entries
        WHERE user_id = ${userId}
          AND logged_at = ${date}
        ORDER BY COALESCE(display_order, 999999999) ASC, created_at ASC
      `;
    } else {
      entries = await sql`
        SELECT id, logged_at::text, meal_type, display_order::float, food_name, serving_size,
               calories::float, protein_g::float, carbs_g::float,
               fat_g::float, fiber_g::float, sugar_g::float, sodium_mg::float, source, recipe_id, created_at::text
        FROM food_log_entries
        WHERE user_id = ${userId}
          AND logged_at >= CURRENT_DATE - (${weeks} * INTERVAL '1 week')
        ORDER BY logged_at DESC, COALESCE(display_order, 999999999) ASC, created_at ASC
      `;
    }
    return NextResponse.json(entries);
  } catch (error) {
    return handleApiError(error, "Failed to load food log");
  }
}

export async function POST(req: Request) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    const body = await parseJsonBody(req, createFoodLogSchema);
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
      sugar_g,
      sodium_mg,
      source,
      recipe_id,
    } = body;
    const normalizedFoodName = formatFoodName(String(food_name));
    if (!normalizedFoodName) {
      return NextResponse.json({ error: "food_name is required" }, { status: 400 });
    }

    const resolvedDate = logged_at ?? localDateStr();
    const [orderRow] = await sql`
      SELECT COALESCE(MAX(display_order), 0)::float AS max_order
      FROM food_log_entries
      WHERE user_id = ${userId}
        AND logged_at = ${resolvedDate}
        AND COALESCE(meal_type, 'snack') = ${meal_type ?? "snack"}
    `;
    const nextOrder = Number(orderRow?.max_order ?? 0) + 10;

    const [entry] = await sql`
      INSERT INTO food_log_entries
        (user_id, logged_at, meal_type, display_order, food_name, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source, recipe_id)
      VALUES (
        ${userId},
        ${resolvedDate},
        ${meal_type ?? null},
        ${nextOrder},
        ${normalizedFoodName},
        ${serving_size ?? null},
        ${calories},
        ${protein_g},
        ${carbs_g},
        ${fat_g},
        ${fiber_g},
        ${sugar_g},
        ${sodium_mg},
        ${source},
        ${recipe_id ?? null}
      )
      RETURNING id, logged_at::text, meal_type, display_order::float, food_name, serving_size,
                calories::float, protein_g::float, carbs_g::float,
                fat_g::float, fiber_g::float, sugar_g::float, sodium_mg::float, source, recipe_id, created_at::text
    `;

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Failed to create food log entry");
  }
}
