import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  const { id } = await context.params;
  const itemId = Number(id);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const checked = typeof body.checked === "boolean" ? body.checked : null;
    const liked = typeof body.liked === "boolean" ? body.liked : null;
    const validCategories = new Set(["fruits", "veggies", "breads", "meats", "dairy", "spices_sauces", "sweets", "misc"]);
    const categoryProvided = Object.prototype.hasOwnProperty.call(body, "category");
    const category =
      typeof body.category === "string" && validCategories.has(body.category)
        ? body.category
        : body.category === null
          ? null
          : undefined;
    const sortOrder = Number(body.sort_order);
    const normalizedSortOrder = Number.isFinite(sortOrder) ? Math.max(0, Math.floor(sortOrder)) : null;
    const name = typeof body.name === "string" ? body.name.trim() : null;
    const quantity = typeof body.quantity === "string" ? body.quantity.trim() : null;

    const [updated] = await sql`
      UPDATE grocery_items
      SET
        checked = COALESCE(${checked}, checked),
        liked = COALESCE(${liked}, liked),
        category = CASE
          WHEN ${categoryProvided} THEN ${category ?? null}
          ELSE category
        END,
        sort_order = COALESCE(${normalizedSortOrder}, sort_order),
        name = COALESCE(${name || null}, name),
        quantity = COALESCE(${quantity || null}, quantity)
      WHERE id = ${itemId} AND user_id = ${userId}
      RETURNING id, user_id, name, quantity, liked, category, sort_order, checked, source, recipe_id, created_at::text
    `;

    if (!updated) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  const { id } = await context.params;
  const itemId = Number(id);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await sql`
      DELETE FROM grocery_items
      WHERE id = ${itemId} AND user_id = ${userId}
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
