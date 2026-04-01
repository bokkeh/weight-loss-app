import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { handleApiError, parseJsonBody } from "@/lib/api";
import { requireUserId } from "@/lib/route-auth";
import { updateProfileSchema } from "@/lib/validation";

export async function GET(req: Request) {
  try {
    const authState = await requireUserId(req);
    if ("response" in authState) return authState.response;
    const { userId } = authState;

    const [profile] = await sql`
      SELECT
        id, first_name, last_name, email, phone, profile_image_url, account_type, dietary_restrictions,
        calorie_goal::float, protein_goal_g::float, carbs_goal_g::float, fat_goal_g::float,
        fiber_goal_g::float, sugar_goal_g::float, sodium_goal_mg::float, height_in::float, goal_weight_lbs::float,
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
        id, first_name, last_name, email, phone, profile_image_url, account_type, dietary_restrictions,
        calorie_goal::float, protein_goal_g::float, carbs_goal_g::float, fat_goal_g::float,
        fiber_goal_g::float, sugar_goal_g::float, sodium_goal_mg::float, height_in::float, goal_weight_lbs::float,
        onboarding_completed,
        created_at::text, updated_at::text
    `;
    return NextResponse.json(created);
  } catch (error) {
    return handleApiError(error, "Failed to load profile");
  }
}

export async function PUT(req: Request) {
  try {
    const authState = await requireUserId(req);
    if ("response" in authState) return authState.response;
    const { userId } = authState;

    const body = await parseJsonBody(req, updateProfileSchema);
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
      sugar_goal_g,
      sodium_goal_mg,
      height_in,
      goal_weight_lbs,
      onboarding_completed,
    } = body;

    const [profile] = await sql`
      INSERT INTO user_profiles (
        id, first_name, last_name, email, phone, dietary_restrictions, profile_image_url, account_type,
        calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g, fiber_goal_g, sugar_goal_g, sodium_goal_mg,
        height_in, goal_weight_lbs, onboarding_completed
      )
      VALUES (
        ${userId},
        ${first_name ?? null},
        ${last_name ?? null},
        ${email ?? null},
        ${phone ?? null},
        ${dietary_restrictions ?? null},
        ${profile_image_url ?? null},
        'regular',
        ${calorie_goal ?? null},
        ${protein_goal_g ?? null},
        ${carbs_goal_g ?? null},
        ${fat_goal_g ?? null},
        ${fiber_goal_g ?? null},
        ${sugar_goal_g ?? null},
        ${sodium_goal_mg ?? null},
        ${height_in ?? null},
        ${goal_weight_lbs ?? null},
        ${onboarding_completed ?? false}
      )
      ON CONFLICT (id) DO UPDATE SET
        first_name = COALESCE(${first_name ?? null}, user_profiles.first_name),
        last_name = COALESCE(${last_name ?? null}, user_profiles.last_name),
        email = COALESCE(${email ?? null}, user_profiles.email),
        phone = COALESCE(${phone ?? null}, user_profiles.phone),
        dietary_restrictions = COALESCE(${dietary_restrictions ?? null}, user_profiles.dietary_restrictions),
        profile_image_url = COALESCE(${profile_image_url ?? null}, user_profiles.profile_image_url),
        calorie_goal = COALESCE(${calorie_goal ?? null}, user_profiles.calorie_goal),
        protein_goal_g = COALESCE(${protein_goal_g ?? null}, user_profiles.protein_goal_g),
        carbs_goal_g = COALESCE(${carbs_goal_g ?? null}, user_profiles.carbs_goal_g),
        fat_goal_g = COALESCE(${fat_goal_g ?? null}, user_profiles.fat_goal_g),
        fiber_goal_g = COALESCE(${fiber_goal_g ?? null}, user_profiles.fiber_goal_g),
        sugar_goal_g = COALESCE(${sugar_goal_g ?? null}, user_profiles.sugar_goal_g),
        sodium_goal_mg = COALESCE(${sodium_goal_mg ?? null}, user_profiles.sodium_goal_mg),
        height_in = COALESCE(${height_in ?? null}, user_profiles.height_in),
        goal_weight_lbs = COALESCE(${goal_weight_lbs ?? null}, user_profiles.goal_weight_lbs),
        onboarding_completed = COALESCE(
          ${onboarding_completed ?? null},
          user_profiles.onboarding_completed
        )
      RETURNING
        id, first_name, last_name, email, phone, profile_image_url, account_type, dietary_restrictions,
        calorie_goal::float, protein_goal_g::float, carbs_goal_g::float, fat_goal_g::float,
        fiber_goal_g::float, sugar_goal_g::float, sodium_goal_mg::float, height_in::float, goal_weight_lbs::float,
        onboarding_completed,
        created_at::text, updated_at::text
    `;

    return NextResponse.json(profile);
  } catch (error) {
    return handleApiError(error, "Failed to update profile");
  }
}
