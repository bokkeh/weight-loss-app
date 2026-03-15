import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";

async function ensureGroceryImageSchema() {
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

function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\b(fresh|large|small|extra|organic|raw|frozen|boneless|skinless|lean|low-fat|low sodium)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildMealDbImageUrl(name: string): string | null {
  const normalized = normalizeIngredientName(name);
  if (!normalized) return null;
  const ingredient = normalized.split(" ").slice(0, 3).join(" ");
  return `https://www.themealdb.com/images/ingredients/${encodeURIComponent(ingredient)}-small.png`;
}

export async function POST(req: Request) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    await ensureGroceryImageSchema();
    const familyId = await resolveGroceryFamilyId(userId);

    const body = (await req.json().catch(() => ({}))) as { limit?: unknown };
    const limit = Math.max(1, Math.min(8, Number(body.limit) || 6));

    const candidates = await sql`
      SELECT id, name
      FROM grocery_items
      WHERE family_id = ${familyId}
        AND checked = FALSE
        AND image_url IS NULL
        AND (
          image_lookup_attempted_at IS NULL
          OR image_lookup_attempted_at < NOW() - INTERVAL '14 days'
        )
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    const updated = [];
    for (const row of candidates) {
      const imageUrl = buildMealDbImageUrl(String(row.name ?? ""));
      const [saved] = await sql`
        UPDATE grocery_items
        SET
          image_url = ${imageUrl},
          image_lookup_attempted_at = NOW()
        WHERE id = ${row.id}
        RETURNING id, image_url, image_lookup_attempted_at::text
      `;
      if (saved) updated.push(saved);
    }

    return NextResponse.json({ updated });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
