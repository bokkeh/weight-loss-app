import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";

async function ensureProfileTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id                    SERIAL PRIMARY KEY,
        first_name            TEXT,
        last_name             TEXT,
        email                 TEXT,
        phone                 TEXT,
        profile_image_url     TEXT,
        dietary_restrictions  TEXT[],
        calorie_goal          NUMERIC,
        protein_goal_g        NUMERIC,
        carbs_goal_g          NUMERIC,
        fat_goal_g            NUMERIC,
        fiber_goal_g          NUMERIC,
        sodium_goal_mg        NUMERIC,
        height_in             NUMERIC,
        goal_weight_lbs       NUMERIC,
        onboarding_completed  BOOLEAN NOT NULL DEFAULT FALSE,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS calorie_goal NUMERIC`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS protein_goal_g NUMERIC`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS carbs_goal_g NUMERIC`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS fat_goal_g NUMERIC`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS fiber_goal_g NUMERIC`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS sodium_goal_mg NUMERIC`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS height_in NUMERIC`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS goal_weight_lbs NUMERIC`;
    await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE`;
  } catch (error) {
    console.error("ensureProfileTable failed:", error);
  }
}

function parseNumeric(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export async function GET(req: Request) {
  try {
    const authState = await requireUserId(req);
    if ("response" in authState) return authState.response;
    const { userId } = authState;

    await ensureProfileTable();
    const [profile] = await sql`
      SELECT
        id, first_name, last_name, email, phone, profile_image_url, dietary_restrictions,
        calorie_goal::float, protein_goal_g::float, carbs_goal_g::float, fat_goal_g::float,
        fiber_goal_g::float, sodium_goal_mg::float, height_in::float, goal_weight_lbs::float,
        onboarding_completed,
        created_at::text, updated_at::text
      FROM user_profiles
      WHERE id = ${userId}
      LIMIT 1
    `;
    if (profile) return NextResponse.json(profile);

    const [created] = await sql`
      INSERT INTO user_profiles (id)
      VALUES (${userId})
      RETURNING
        id, first_name, last_name, email, phone, profile_image_url, dietary_restrictions,
        calorie_goal::float, protein_goal_g::float, carbs_goal_g::float, fat_goal_g::float,
        fiber_goal_g::float, sodium_goal_mg::float, height_in::float, goal_weight_lbs::float,
        onboarding_completed,
        created_at::text, updated_at::text
    `;
    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const authState = await requireUserId(req);
    if ("response" in authState) return authState.response;
    const { userId } = authState;

    await ensureProfileTable();
    const body = await req.json().catch(() => ({}));
    const {
      first_name,
      last_name,
      email,
      phone,
      dietary_restrictions,
      profile_image_url,
      calorie_goal,
      protein_goal_g,
      carbs_goal_g,
      fat_goal_g,
      fiber_goal_g,
      sodium_goal_mg,
      height_in,
      goal_weight_lbs,
      onboarding_completed,
    } = body as Record<string, unknown>;

    const restrictions = Array.isArray(dietary_restrictions)
      ? dietary_restrictions.map((v) => String(v).trim()).filter(Boolean)
      : null;

    const [profile] = await sql`
      INSERT INTO user_profiles (
        id, first_name, last_name, email, phone, dietary_restrictions, profile_image_url,
        calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g, fiber_goal_g, sodium_goal_mg,
        height_in, goal_weight_lbs, onboarding_completed
      )
      VALUES (
        ${userId},
        ${first_name ? String(first_name).trim() : null},
        ${last_name ? String(last_name).trim() : null},
        ${email ? String(email).trim() : null},
        ${phone ? String(phone).trim() : null},
        ${restrictions},
        ${profile_image_url ? String(profile_image_url).trim() : null},
        ${parseNumeric(calorie_goal)},
        ${parseNumeric(protein_goal_g)},
        ${parseNumeric(carbs_goal_g)},
        ${parseNumeric(fat_goal_g)},
        ${parseNumeric(fiber_goal_g)},
        ${parseNumeric(sodium_goal_mg)},
        ${parseNumeric(height_in)},
        ${parseNumeric(goal_weight_lbs)},
        ${typeof onboarding_completed === "boolean" ? onboarding_completed : false}
      )
      ON CONFLICT (id) DO UPDATE SET
        first_name = COALESCE(${first_name ? String(first_name).trim() : null}, user_profiles.first_name),
        last_name = COALESCE(${last_name ? String(last_name).trim() : null}, user_profiles.last_name),
        email = COALESCE(${email ? String(email).trim() : null}, user_profiles.email),
        phone = COALESCE(${phone ? String(phone).trim() : null}, user_profiles.phone),
        dietary_restrictions = COALESCE(${restrictions}, user_profiles.dietary_restrictions),
        profile_image_url = COALESCE(${profile_image_url ? String(profile_image_url).trim() : null}, user_profiles.profile_image_url),
        calorie_goal = COALESCE(${parseNumeric(calorie_goal)}, user_profiles.calorie_goal),
        protein_goal_g = COALESCE(${parseNumeric(protein_goal_g)}, user_profiles.protein_goal_g),
        carbs_goal_g = COALESCE(${parseNumeric(carbs_goal_g)}, user_profiles.carbs_goal_g),
        fat_goal_g = COALESCE(${parseNumeric(fat_goal_g)}, user_profiles.fat_goal_g),
        fiber_goal_g = COALESCE(${parseNumeric(fiber_goal_g)}, user_profiles.fiber_goal_g),
        sodium_goal_mg = COALESCE(${parseNumeric(sodium_goal_mg)}, user_profiles.sodium_goal_mg),
        height_in = COALESCE(${parseNumeric(height_in)}, user_profiles.height_in),
        goal_weight_lbs = COALESCE(${parseNumeric(goal_weight_lbs)}, user_profiles.goal_weight_lbs),
        onboarding_completed = COALESCE(
          ${typeof onboarding_completed === "boolean" ? onboarding_completed : null},
          user_profiles.onboarding_completed
        )
      RETURNING
        id, first_name, last_name, email, phone, profile_image_url, dietary_restrictions,
        calorie_goal::float, protein_goal_g::float, carbs_goal_g::float, fat_goal_g::float,
        fiber_goal_g::float, sodium_goal_mg::float, height_in::float, goal_weight_lbs::float,
        onboarding_completed,
        created_at::text, updated_at::text
    `;

    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
