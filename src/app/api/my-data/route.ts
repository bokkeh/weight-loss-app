import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";

type SharePrefs = {
  share_profile: boolean;
  share_weight: boolean;
  share_food: boolean;
  share_water: boolean;
  share_recipes: boolean;
  share_chat: boolean;
  share_family: boolean;
};

const DEFAULT_PREFS: SharePrefs = {
  share_profile: true,
  share_weight: true,
  share_food: true,
  share_water: true,
  share_recipes: true,
  share_chat: true,
  share_family: true,
};

async function ensureUserDataPreferencesTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS user_data_preferences (
      user_id        INTEGER PRIMARY KEY,
      share_profile  BOOLEAN NOT NULL DEFAULT TRUE,
      share_weight   BOOLEAN NOT NULL DEFAULT TRUE,
      share_food     BOOLEAN NOT NULL DEFAULT TRUE,
      share_water    BOOLEAN NOT NULL DEFAULT TRUE,
      share_recipes  BOOLEAN NOT NULL DEFAULT TRUE,
      share_chat     BOOLEAN NOT NULL DEFAULT TRUE,
      share_family   BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function ensureFamilySchema() {
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
    CREATE TABLE IF NOT EXISTS family_invites (
      id           SERIAL PRIMARY KEY,
      family_id    INTEGER NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
      email        TEXT NOT NULL,
      circle       TEXT NOT NULL CHECK (circle IN ('family', 'extended')),
      status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
      invited_by   INTEGER NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      accepted_at  TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS family_shared_grocery_items (
      id          SERIAL PRIMARY KEY,
      family_id   INTEGER NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      quantity    TEXT,
      checked     BOOLEAN NOT NULL DEFAULT FALSE,
      created_by  INTEGER NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS family_kid_naps (
      id          SERIAL PRIMARY KEY,
      family_id   INTEGER NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
      kid_name    TEXT NOT NULL,
      nap_date    DATE NOT NULL DEFAULT CURRENT_DATE,
      start_time  TEXT,
      end_time    TEXT,
      notes       TEXT,
      created_by  INTEGER NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS family_partner_cycles (
      id                  SERIAL PRIMARY KEY,
      family_id           INTEGER NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
      partner_name        TEXT,
      cycle_start_date    DATE NOT NULL,
      cycle_length_days   INTEGER NOT NULL DEFAULT 28,
      period_length_days  INTEGER NOT NULL DEFAULT 5,
      notes               TEXT,
      created_by          INTEGER NOT NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function getPrefsForUser(userId: number) {
  await ensureUserDataPreferencesTable();
  const [prefs] = await sql`
    SELECT
      share_profile,
      share_weight,
      share_food,
      share_water,
      share_recipes,
      share_chat,
      share_family
    FROM user_data_preferences
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  return {
    ...DEFAULT_PREFS,
    ...(prefs ?? {}),
  } as SharePrefs;
}

export async function GET(req: Request) {
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;
  const { userId } = auth;

  try {
    const url = new URL(req.url);
    const wantsExport = url.searchParams.get("export") === "1";
    const prefs = await getPrefsForUser(userId);

    if (!wantsExport) {
      return NextResponse.json({ preferences: prefs });
    }

    await ensureFamilySchema();

    const [profile] = await sql`
      SELECT *
      FROM user_profiles
      WHERE id = ${userId}
      LIMIT 1
    `;
    const weightEntries = await sql`
      SELECT *
      FROM weight_entries
      WHERE user_id = ${userId}
      ORDER BY logged_at DESC
    `;
    const foodLogEntries = await sql`
      SELECT *
      FROM food_log_entries
      WHERE user_id = ${userId}
      ORDER BY logged_at DESC
    `;
    const waterLogEntries = await sql`
      SELECT *
      FROM water_log_entries
      WHERE user_id = ${userId}
      ORDER BY logged_at DESC
    `;
    const recipes = await sql`
      SELECT *
      FROM recipes
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    const chatMessages = await sql`
      SELECT *
      FROM chat_messages
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    const groceryItems = await sql`
      SELECT *
      FROM grocery_items
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    const featureRequests = await sql`
      SELECT *
      FROM feature_requests
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    const authAccounts = await sql`
      SELECT provider, provider_account_id, created_at
      FROM auth_accounts
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    const loginEvents = await sql`
      SELECT user_id, email, provider, logged_in_at
      FROM auth_login_events
      WHERE user_id = ${userId}
      ORDER BY logged_in_at DESC
    `;

    const familyGroups = await sql`
      SELECT fg.*
      FROM family_groups fg
      WHERE fg.owner_id = ${userId}
         OR EXISTS (
          SELECT 1
          FROM family_memberships fm
          WHERE fm.family_id = fg.id
            AND fm.user_id = ${userId}
        )
      ORDER BY fg.created_at DESC
    `;
    const familyMemberships = await sql`
      SELECT fm.*
      FROM family_memberships fm
      WHERE fm.user_id = ${userId}
         OR EXISTS (
          SELECT 1
          FROM family_memberships my
          WHERE my.family_id = fm.family_id
            AND my.user_id = ${userId}
        )
      ORDER BY fm.created_at DESC
    `;
    const familyInvites = await sql`
      SELECT fi.*
      FROM family_invites fi
      WHERE LOWER(fi.email) = LOWER(COALESCE(${String(profile?.email ?? "")}, ''))
         OR fi.invited_by = ${userId}
         OR EXISTS (
          SELECT 1
          FROM family_memberships my
          WHERE my.family_id = fi.family_id
            AND my.user_id = ${userId}
        )
      ORDER BY fi.created_at DESC
    `;
    const familySharedGroceryItems = await sql`
      SELECT fgi.*
      FROM family_shared_grocery_items fgi
      WHERE fgi.created_by = ${userId}
         OR EXISTS (
          SELECT 1
          FROM family_memberships my
          WHERE my.family_id = fgi.family_id
            AND my.user_id = ${userId}
        )
      ORDER BY fgi.created_at DESC
    `;
    const familyKidNaps = await sql`
      SELECT fkn.*
      FROM family_kid_naps fkn
      WHERE fkn.created_by = ${userId}
         OR EXISTS (
          SELECT 1
          FROM family_memberships my
          WHERE my.family_id = fkn.family_id
            AND my.user_id = ${userId}
        )
      ORDER BY fkn.created_at DESC
    `;
    const familyPartnerCycles = await sql`
      SELECT fpc.*
      FROM family_partner_cycles fpc
      WHERE fpc.created_by = ${userId}
         OR EXISTS (
          SELECT 1
          FROM family_memberships my
          WHERE my.family_id = fpc.family_id
            AND my.user_id = ${userId}
        )
      ORDER BY fpc.created_at DESC
    `;

    return NextResponse.json({
      exported_at: new Date().toISOString(),
      user_id: userId,
      preferences: prefs,
      data: {
        profile: profile ?? null,
        auth_accounts: authAccounts,
        auth_login_events: loginEvents,
        feature_requests: featureRequests,
        weight_entries: weightEntries,
        food_log_entries: foodLogEntries,
        water_log_entries: waterLogEntries,
        recipes,
        chat_messages: chatMessages,
        grocery_items: groceryItems,
        family_groups: familyGroups,
        family_memberships: familyMemberships,
        family_invites: familyInvites,
        family_shared_grocery_items: familySharedGroceryItems,
        family_kid_naps: familyKidNaps,
        family_partner_cycles: familyPartnerCycles,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;
  const { userId } = auth;

  try {
    await ensureUserDataPreferencesTable();
    const body = (await req.json().catch(() => ({}))) as Partial<SharePrefs>;

    const nextPrefs: SharePrefs = {
      share_profile: body.share_profile !== false,
      share_weight: body.share_weight !== false,
      share_food: body.share_food !== false,
      share_water: body.share_water !== false,
      share_recipes: body.share_recipes !== false,
      share_chat: body.share_chat !== false,
      share_family: body.share_family !== false,
    };

    await sql`
      INSERT INTO user_data_preferences (
        user_id,
        share_profile,
        share_weight,
        share_food,
        share_water,
        share_recipes,
        share_chat,
        share_family,
        updated_at
      )
      VALUES (
        ${userId},
        ${nextPrefs.share_profile},
        ${nextPrefs.share_weight},
        ${nextPrefs.share_food},
        ${nextPrefs.share_water},
        ${nextPrefs.share_recipes},
        ${nextPrefs.share_chat},
        ${nextPrefs.share_family},
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE
      SET
        share_profile = EXCLUDED.share_profile,
        share_weight = EXCLUDED.share_weight,
        share_food = EXCLUDED.share_food,
        share_water = EXCLUDED.share_water,
        share_recipes = EXCLUDED.share_recipes,
        share_chat = EXCLUDED.share_chat,
        share_family = EXCLUDED.share_family,
        updated_at = NOW()
    `;

    return NextResponse.json({ ok: true, preferences: nextPrefs });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
