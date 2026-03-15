import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";

const GROCERY_ITEM_SELECT = sql`
  grocery_items.id,
  grocery_items.user_id,
  grocery_items.family_id,
  grocery_items.name,
  grocery_items.quantity,
  grocery_items.liked,
  grocery_items.category,
  grocery_items.sort_order,
  grocery_items.checked,
  grocery_items.source,
  grocery_items.recipe_id,
  grocery_items.image_url,
  grocery_items.image_lookup_attempted_at::text,
  grocery_items.created_at::text,
  NULLIF(
    TRIM(
      CONCAT(
        COALESCE(user_profiles.first_name, ''),
        ' ',
        COALESCE(user_profiles.last_name, '')
      )
    ),
    ''
  ) AS added_by_name
`;

async function ensureGroceryScopeSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS family_groups (
      id          SERIAL PRIMARY KEY,
      owner_id    INTEGER NOT NULL,
      name        TEXT NOT NULL DEFAULT 'My Family',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS family_memberships (
      id          SERIAL PRIMARY KEY,
      family_id   INTEGER NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL,
      circle      TEXT NOT NULL CHECK (circle IN ('family', 'extended')),
      role        TEXT NOT NULL DEFAULT 'member',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(family_id, user_id)
    )
  `;
  await sql`ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS family_id INTEGER`;
  await sql`ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS image_url TEXT`;
  await sql`ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS image_lookup_attempted_at TIMESTAMPTZ`;
}

async function resolveGroceryFamilyId(userId: number): Promise<number> {
  const [member] = await sql`
    SELECT family_id
    FROM family_memberships
    WHERE user_id = ${userId}
    ORDER BY (role = 'owner') ASC, created_at DESC
    LIMIT 1
  `;
  if (member?.family_id) return Number(member.family_id);

  const [createdFamily] = await sql`
    INSERT INTO family_groups (owner_id, name)
    VALUES (${userId}, 'My Family')
    RETURNING id
  `;
  const familyId = Number(createdFamily.id);
  await sql`
    INSERT INTO family_memberships (family_id, user_id, circle, role)
    VALUES (${familyId}, ${userId}, 'family', 'owner')
    ON CONFLICT (family_id, user_id) DO NOTHING
  `;
  return familyId;
}

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
    await ensureGroceryScopeSchema();
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
    await ensureGroceryScopeSchema();
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
