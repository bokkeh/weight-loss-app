import sql from "@/lib/db";

export const GROCERY_ITEM_SELECT = sql`
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

export async function ensureGrocerySchema() {
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
      image_url   TEXT,
      image_lookup_attempted_at TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS grocery_trips (
      id            SERIAL PRIMARY KEY,
      family_id     INTEGER NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
      completed_on  DATE NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(family_id, completed_on)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS grocery_trip_items (
      id            SERIAL PRIMARY KEY,
      trip_id       INTEGER NOT NULL REFERENCES grocery_trips(id) ON DELETE CASCADE,
      family_id     INTEGER NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
      user_id       INTEGER NOT NULL,
      name          TEXT NOT NULL,
      quantity      TEXT,
      liked         BOOLEAN NOT NULL DEFAULT FALSE,
      category      TEXT,
      source        TEXT NOT NULL DEFAULT 'manual',
      recipe_id     INTEGER,
      image_url     TEXT,
      purchased_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS liked BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS category TEXT`;
  await sql`ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS family_id INTEGER`;
  await sql`ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS image_url TEXT`;
  await sql`ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS image_lookup_attempted_at TIMESTAMPTZ`;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_grocery_items_user_checked_created
      ON grocery_items (user_id, checked, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_grocery_items_family_checked_created
      ON grocery_items (family_id, checked, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_grocery_trip_items_family_purchased
      ON grocery_trip_items (family_id, purchased_at DESC)
  `;
}

export async function resolveGroceryFamilyId(userId: number): Promise<number> {
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

export async function archivePurchasedGroceryItem(itemId: number, familyId: number) {
  const [item] = await sql`
    SELECT *
    FROM grocery_items
    WHERE id = ${itemId} AND family_id = ${familyId}
    LIMIT 1
  `;

  if (!item) {
    return null;
  }

  const [trip] = await sql`
    INSERT INTO grocery_trips (family_id, completed_on)
    VALUES (
      ${familyId},
      (CURRENT_TIMESTAMP AT TIME ZONE 'America/Chicago')::date
    )
    ON CONFLICT (family_id, completed_on)
    DO UPDATE SET completed_on = EXCLUDED.completed_on
    RETURNING id, completed_on::text, created_at::text
  `;

  const [tripItem] = await sql`
    INSERT INTO grocery_trip_items (
      trip_id,
      family_id,
      user_id,
      name,
      quantity,
      liked,
      category,
      source,
      recipe_id,
      image_url
    )
    VALUES (
      ${trip.id},
      ${familyId},
      ${item.user_id},
      ${item.name},
      ${item.quantity ?? null},
      ${Boolean(item.liked)},
      ${item.category ?? null},
      ${item.source ?? "manual"},
      ${item.recipe_id ?? null},
      ${item.image_url ?? null}
    )
    RETURNING
      id,
      trip_id,
      family_id,
      user_id,
      name,
      quantity,
      liked,
      category,
      source,
      recipe_id,
      image_url,
      purchased_at::text
  `;

  await sql`
    DELETE FROM grocery_items
    WHERE id = ${itemId} AND family_id = ${familyId}
  `;

  return {
    removed_id: itemId,
    trip,
    trip_item: tripItem,
  };
}
