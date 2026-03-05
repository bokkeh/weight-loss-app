import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authState = await requireUserId();
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    const body = await req.json();
    const { food_name, serving_size, meal_type, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg } = body;
    const [entry] = await sql`
      UPDATE food_log_entries
      SET food_name  = ${food_name},
          serving_size = ${serving_size ?? null},
          meal_type  = ${meal_type ?? null},
          calories   = ${Number(calories)},
          protein_g  = ${Number(protein_g)},
          carbs_g    = ${Number(carbs_g)},
          fat_g      = ${Number(fat_g)},
          fiber_g    = ${Number(fiber_g ?? 0)},
          sodium_mg  = ${Number(sodium_mg ?? 0)}
      WHERE id = ${Number(id)}
        AND user_id = ${userId}
      RETURNING id, logged_at::text, meal_type, food_name, serving_size,
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
  const authState = await requireUserId();
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
