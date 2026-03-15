import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";

async function ensureRecipesTable() {
  try {
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
      CREATE TABLE IF NOT EXISTS recipes (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER NOT NULL DEFAULT 1,
        family_id     INTEGER,
        created_by    INTEGER,
        name          TEXT NOT NULL,
        description   TEXT,
        servings      INTEGER NOT NULL DEFAULT 1,
        calories      NUMERIC NOT NULL DEFAULT 0,
        protein_g     NUMERIC NOT NULL DEFAULT 0,
        carbs_g       NUMERIC NOT NULL DEFAULT 0,
        fat_g         NUMERIC NOT NULL DEFAULT 0,
        fiber_g       NUMERIC NOT NULL DEFAULT 0,
        ingredients   TEXT,
        instructions  TEXT,
        image_url     TEXT,
        tags          TEXT[] NOT NULL DEFAULT '{}',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes (user_id)`;
    await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS family_id INTEGER`;
    await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS created_by INTEGER`;
    await sql`CREATE INDEX IF NOT EXISTS idx_recipes_family_id ON recipes (family_id)`;
  } catch (error) {
    console.error("ensureRecipesTable failed:", error);
  }
}

async function resolvePrimaryFamilyId(userId: number): Promise<number> {
  const [member] = await sql`
    SELECT family_id
    FROM family_memberships
    WHERE user_id = ${userId}
    ORDER BY (role = 'owner') DESC, created_at DESC
    LIMIT 1
  `;
  if (member?.family_id) return Number(member.family_id);

  const [created] = await sql`
    INSERT INTO family_groups (owner_id, name)
    VALUES (${userId}, 'My Family')
    RETURNING id
  `;
  const familyId = Number(created.id);
  await sql`
    INSERT INTO family_memberships (family_id, user_id, circle, role)
    VALUES (${familyId}, ${userId}, 'family', 'owner')
    ON CONFLICT (family_id, user_id) DO NOTHING
  `;
  return familyId;
}

async function canAccessFamily(userId: number, familyId: number): Promise<boolean> {
  const [row] = await sql`
    SELECT id
    FROM family_memberships
    WHERE user_id = ${userId}
      AND family_id = ${familyId}
    LIMIT 1
  `;
  return Boolean(row?.id);
}

export async function GET(req: Request) {
  try {
    const authState = await requireUserId(req);
    if ("response" in authState) return authState.response;
    const { userId } = authState;
    const { searchParams } = new URL(req.url);
    const tag = searchParams.get("tag");
    const requestedFamilyId = Number(searchParams.get("family_id"));
    await ensureRecipesTable();
    const familyId = Number.isFinite(requestedFamilyId) && requestedFamilyId > 0
      ? requestedFamilyId
      : await resolvePrimaryFamilyId(userId);
    if (!(await canAccessFamily(userId, familyId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await sql`
      UPDATE recipes
      SET family_id = ${familyId},
          created_by = COALESCE(created_by, user_id)
      WHERE family_id IS NULL
        AND user_id = ${userId}
    `;

    let recipes;
    if (tag) {
      recipes = await sql`
        SELECT id, name, description, servings,
               calories::float, protein_g::float, carbs_g::float, fat_g::float, fiber_g::float,
               ingredients, instructions, image_url, tags, created_at::text, updated_at::text
        FROM recipes
        WHERE family_id = ${familyId}
          AND ${tag} = ANY(tags)
        ORDER BY created_at DESC
      `;
    } else {
      recipes = await sql`
        SELECT id, name, description, servings,
               calories::float, protein_g::float, carbs_g::float, fat_g::float, fiber_g::float,
               ingredients, instructions, image_url, tags, created_at::text, updated_at::text
        FROM recipes
        WHERE family_id = ${familyId}
        ORDER BY created_at DESC
      `;
    }
    return NextResponse.json(recipes);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authState = await requireUserId(req);
    if ("response" in authState) return authState.response;
    const { userId } = authState;
    await ensureRecipesTable();
    const familyId = await resolvePrimaryFamilyId(userId);
    if (!(await canAccessFamily(userId, familyId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      description,
      servings = 1,
      calories = 0,
      protein_g = 0,
      carbs_g = 0,
      fat_g = 0,
      fiber_g = 0,
      ingredients,
      instructions,
      tags = [],
      image_url,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const [recipe] = await sql`
      INSERT INTO recipes
        (user_id, family_id, created_by, name, description, servings, calories, protein_g, carbs_g, fat_g, fiber_g, ingredients, instructions, image_url, tags)
      VALUES (
        ${userId},
        ${familyId},
        ${userId},
        ${name},
        ${description ?? null},
        ${Number(servings)},
        ${Number(calories)},
        ${Number(protein_g)},
        ${Number(carbs_g)},
        ${Number(fat_g)},
        ${Number(fiber_g)},
        ${ingredients ?? null},
        ${instructions ?? null},
        ${image_url ?? null},
        ${tags}
      )
      RETURNING id, name, description, servings,
                calories::float, protein_g::float, carbs_g::float, fat_g::float, fiber_g::float,
                ingredients, instructions, image_url, tags, created_at::text, updated_at::text
    `;

    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
