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

function pickOpenFoodFactsImage(product: Record<string, unknown> | null): string | null {
  if (!product) return null;

  const candidates = [
    product.image_front_small_url,
    product.image_front_thumb_url,
    product.image_front_url,
    (product.selected_images as { front?: { display?: { en?: string; ["400"]?: string } } } | undefined)?.front?.display?.en,
    (product.selected_images as { front?: { display?: { ["400"]?: string } } } | undefined)?.front?.display?.["400"],
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.startsWith("http")) {
      return value;
    }
  }
  return null;
}

async function lookupFoodImage(name: string): Promise<string | null> {
  const params = new URLSearchParams({
    search_terms: name,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "1",
    fields: "product_name,image_front_small_url,image_front_thumb_url,image_front_url,selected_images",
  });

  const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`, {
    headers: {
      "User-Agent": "WeightTrack Grocery Images/1.0",
    },
    next: { revalidate: 60 * 60 * 24 * 14 },
  });

  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { products?: Array<Record<string, unknown>> } | null;
  const product = Array.isArray(data?.products) ? data.products[0] : null;
  return pickOpenFoodFactsImage(product);
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
      const imageUrl = await lookupFoodImage(String(row.name ?? ""));
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
