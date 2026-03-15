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

function normalizeIngredientLines(raw: string): Array<{ name: string; quantity: string | null }> {
  return raw
    .split(/\r?\n|,/g)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+[\d./\s]*(?:cup|cups|tbsp|tsp|oz|g|kg|lb|lbs|ml|l)?\s+)(.+)$/i);
      if (!match) return { name: line, quantity: null };
      return { quantity: match[1].trim(), name: match[2].trim() };
    });
}

async function ensureGroceryTable() {
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
  await sql`
    CREATE TABLE IF NOT EXISTS grocery_items (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL,
      family_id   INTEGER,
      name        TEXT NOT NULL,
      quantity    TEXT,
      liked       BOOLEAN NOT NULL DEFAULT FALSE,
      category    TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      checked     BOOLEAN NOT NULL DEFAULT FALSE,
      source      TEXT NOT NULL DEFAULT 'manual',
      recipe_id   INTEGER,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS liked BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS category TEXT`;
  await sql`ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS family_id INTEGER`;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_grocery_items_user_checked_created
      ON grocery_items (user_id, checked, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_grocery_items_family_checked_created
      ON grocery_items (family_id, checked, created_at DESC)
  `;
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

export async function GET(req: Request) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    await ensureGroceryTable();
    const familyId = await resolveGroceryFamilyId(userId);
    await sql`
      UPDATE grocery_items
      SET family_id = ${familyId}
      WHERE family_id IS NULL
        AND user_id = ${userId}
    `;
    const items = await sql`
      SELECT ${GROCERY_ITEM_SELECT}
      FROM grocery_items
      LEFT JOIN user_profiles ON user_profiles.id = grocery_items.user_id
      WHERE grocery_items.family_id = ${familyId}
      ORDER BY checked ASC, sort_order ASC, created_at DESC
    `;
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    await ensureGroceryTable();
    const familyId = await resolveGroceryFamilyId(userId);
    await sql`
      UPDATE grocery_items
      SET family_id = ${familyId}
      WHERE family_id IS NULL
        AND user_id = ${userId}
    `;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const recipeId = Number(body.recipe_id);

    if (Number.isFinite(recipeId) && recipeId > 0) {
      const [recipe] = await sql`
        SELECT id, ingredients
        FROM recipes
        WHERE id = ${recipeId} AND user_id = ${userId}
        LIMIT 1
      `;
      if (!recipe) {
        return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
      }
      const ingredientsRaw = String(recipe.ingredients ?? "");
      const parsed = normalizeIngredientLines(ingredientsRaw);
      if (parsed.length === 0) {
        return NextResponse.json({ error: "Recipe has no ingredients to add." }, { status: 400 });
      }

      const inserted = [];
      for (const item of parsed) {
        const [row] = await sql`
          WITH next_sort AS (
            SELECT COALESCE(MAX(sort_order), 0) + 1 AS value
            FROM grocery_items
            WHERE user_id = ${userId}
          )
          INSERT INTO grocery_items (user_id, name, quantity, source, recipe_id, sort_order)
          SELECT ${userId}, ${item.name}, ${item.quantity}, 'recipe', ${recipeId}, next_sort.value
          FROM next_sort
          RETURNING id
        `;
        await sql`
          UPDATE grocery_items
          SET family_id = ${familyId}
          WHERE id = ${row.id}
        `;
        const [hydrated] = await sql`
          SELECT ${GROCERY_ITEM_SELECT}
          FROM grocery_items
          LEFT JOIN user_profiles ON user_profiles.id = grocery_items.user_id
          WHERE grocery_items.id = ${row.id}
          LIMIT 1
        `;
        inserted.push(hydrated);
      }
      return NextResponse.json(inserted, { status: 201 });
    }

    const items = Array.isArray(body.items) ? body.items : null;
    if (items) {
      const inserted = [];
      for (const raw of items) {
        const item = raw as Record<string, unknown>;
        const name = String(item.name ?? "").trim();
        if (!name) continue;
        const quantity = String(item.quantity ?? "").trim() || null;
        const [row] = await sql`
          WITH next_sort AS (
            SELECT COALESCE(MAX(sort_order), 0) + 1 AS value
            FROM grocery_items
            WHERE user_id = ${userId}
          )
          INSERT INTO grocery_items (user_id, family_id, name, quantity, source, sort_order)
          SELECT ${userId}, ${familyId}, ${name}, ${quantity}, 'ai', next_sort.value
          FROM next_sort
          RETURNING id
        `;
        const [hydrated] = await sql`
          SELECT ${GROCERY_ITEM_SELECT}
          FROM grocery_items
          LEFT JOIN user_profiles ON user_profiles.id = grocery_items.user_id
          WHERE grocery_items.id = ${row.id}
          LIMIT 1
        `;
        inserted.push(hydrated);
      }
      return NextResponse.json(inserted, { status: 201 });
    }

    const name = String(body.name ?? "").trim();
    const quantity = String(body.quantity ?? "").trim() || null;
    if (!name) {
      return NextResponse.json({ error: "Item name is required." }, { status: 400 });
    }

    const [created] = await sql`
      WITH next_sort AS (
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS value
        FROM grocery_items
        WHERE user_id = ${userId}
      )
      INSERT INTO grocery_items (user_id, family_id, name, quantity, source, sort_order)
      SELECT ${userId}, ${familyId}, ${name}, ${quantity}, 'manual', next_sort.value
      FROM next_sort
      RETURNING id
    `;
    const [hydrated] = await sql`
      SELECT ${GROCERY_ITEM_SELECT}
      FROM grocery_items
      LEFT JOIN user_profiles ON user_profiles.id = grocery_items.user_id
      WHERE grocery_items.id = ${created.id}
      LIMIT 1
    `;
    return NextResponse.json(hydrated, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
