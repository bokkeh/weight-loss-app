import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/route-auth";
import sql from "@/lib/db";
import {
  archivePurchasedGroceryItem,
  ensureGrocerySchema,
  GROCERY_ITEM_SELECT,
  resolveGroceryFamilyId,
} from "@/lib/grocery";

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
    await ensureGrocerySchema();
    const familyId = await resolveGroceryFamilyId(userId);
    await sql`
      UPDATE grocery_items
      SET family_id = ${familyId}
      WHERE family_id IS NULL
        AND user_id = ${userId}
    `;
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

    if (checked === true) {
      const archived = await archivePurchasedGroceryItem(itemId, familyId);
      if (!archived) {
        return NextResponse.json({ error: "Item not found." }, { status: 404 });
      }
      return NextResponse.json({ archived: true, ...archived });
    }

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
      WHERE id = ${itemId} AND family_id = ${familyId}
      RETURNING id
    `;

    if (!updated) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }
    const [hydrated] = await sql`
      SELECT ${GROCERY_ITEM_SELECT}
      FROM grocery_items
      LEFT JOIN user_profiles ON user_profiles.id = grocery_items.user_id
      WHERE grocery_items.id = ${updated.id}
      LIMIT 1
    `;
    return NextResponse.json(hydrated);
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
    await ensureGrocerySchema();
    const familyId = await resolveGroceryFamilyId(userId);
    await sql`
      UPDATE grocery_items
      SET family_id = ${familyId}
      WHERE family_id IS NULL
        AND user_id = ${userId}
    `;
    await sql`
      DELETE FROM grocery_items
      WHERE id = ${itemId} AND family_id = ${familyId}
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
