import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";
import { ensureGrocerySchema, resolveGroceryFamilyId } from "@/lib/grocery";

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

export async function GET(req: Request) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    await ensureGrocerySchema();
    const familyId = await resolveGroceryFamilyId(userId);
    await sql`
      UPDATE grocery_items
      SET family_id = ${familyId}
      WHERE family_id IS NULL
        AND user_id = ${userId}
    `;
    const items = await sql`
      SELECT
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
      FROM grocery_items
      LEFT JOIN user_profiles ON user_profiles.id = grocery_items.user_id
      WHERE grocery_items.family_id = ${familyId}
        AND grocery_items.checked = FALSE
      ORDER BY sort_order ASC, created_at DESC
    `;
    const participants = await sql`
      SELECT
        family_memberships.user_id,
        family_memberships.circle,
        family_memberships.role,
        NULLIF(
          TRIM(
            CONCAT(
              COALESCE(user_profiles.first_name, ''),
              ' ',
              COALESCE(user_profiles.last_name, '')
            )
          ),
          ''
        ) AS name,
        user_profiles.email,
        user_profiles.profile_image_url
      FROM family_memberships
      LEFT JOIN user_profiles ON user_profiles.id = family_memberships.user_id
      WHERE family_memberships.family_id = ${familyId}
      ORDER BY (family_memberships.role = 'owner') DESC, family_memberships.created_at ASC
    `;
    const [family] = await sql`
      SELECT id, name
      FROM family_groups
      WHERE id = ${familyId}
      LIMIT 1
    `;
    const tripRows = await sql`
      WITH recent_trips AS (
        SELECT id, completed_on, created_at
        FROM grocery_trips
        WHERE family_id = ${familyId}
        ORDER BY completed_on DESC, id DESC
        LIMIT 12
      )
      SELECT
        recent_trips.id AS trip_id,
        recent_trips.completed_on::text,
        recent_trips.created_at::text AS trip_created_at,
        grocery_trip_items.id,
        grocery_trip_items.family_id,
        grocery_trip_items.user_id,
        grocery_trip_items.name,
        grocery_trip_items.quantity,
        grocery_trip_items.liked,
        grocery_trip_items.category,
        grocery_trip_items.source,
        grocery_trip_items.recipe_id,
        grocery_trip_items.image_url,
        grocery_trip_items.purchased_at::text,
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
      FROM recent_trips
      JOIN grocery_trip_items ON grocery_trip_items.trip_id = recent_trips.id
      LEFT JOIN user_profiles ON user_profiles.id = grocery_trip_items.user_id
      ORDER BY recent_trips.completed_on DESC, grocery_trip_items.purchased_at DESC, grocery_trip_items.id DESC
    `;
    const previousTrips = tripRows.reduce<Array<Record<string, unknown>>>((acc, row) => {
      const tripId = Number(row.trip_id);
      const existing = acc.find((entry) => Number(entry.id) === tripId);
      const item = {
        id: Number(row.id),
        family_id: Number(row.family_id),
        user_id: Number(row.user_id),
        name: row.name,
        quantity: row.quantity,
        liked: Boolean(row.liked),
        category: row.category,
        source: row.source,
        recipe_id: row.recipe_id,
        image_url: row.image_url,
        purchased_at: row.purchased_at,
        added_by_name: row.added_by_name,
      };
      if (existing) {
        (existing.items as Array<Record<string, unknown>>).push(item);
        return acc;
      }
      acc.push({
        id: tripId,
        completed_on: row.completed_on,
        created_at: row.trip_created_at,
        items: [item],
      });
      return acc;
    }, []);
    const recentlyOrdered = await sql`
      SELECT *
      FROM (
        SELECT DISTINCT ON (LOWER(name))
          grocery_trip_items.id,
          grocery_trip_items.family_id,
          grocery_trip_items.user_id,
          grocery_trip_items.name,
          grocery_trip_items.quantity,
          grocery_trip_items.liked,
          grocery_trip_items.category,
          grocery_trip_items.source,
          grocery_trip_items.recipe_id,
          grocery_trip_items.image_url,
          grocery_trip_items.purchased_at::text,
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
        FROM grocery_trip_items
        LEFT JOIN user_profiles ON user_profiles.id = grocery_trip_items.user_id
        WHERE grocery_trip_items.family_id = ${familyId}
        ORDER BY LOWER(name), purchased_at DESC
      ) recent
      ORDER BY purchased_at DESC
      LIMIT 12
    `;
    return NextResponse.json({
      items,
      participants,
      family: family ?? { id: familyId, name: "My Family" },
      previous_trips: previousTrips,
      recently_ordered: recentlyOrdered,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

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
          SELECT
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
          SELECT
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
      SELECT
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
