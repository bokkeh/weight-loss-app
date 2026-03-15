import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireAdminUser } from "@/lib/route-auth";

const ADMIN_TIME_ZONE = "America/Chicago";

export async function GET() {
  const adminState = await requireAdminUser();
  if ("response" in adminState) return adminState.response;

  try {
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

    const users = await sql`
      WITH all_user_ids AS (
        SELECT id AS user_id FROM user_profiles
        UNION
        SELECT user_id FROM auth_accounts
        UNION
        SELECT user_id FROM auth_login_events
      ),
      profile_agg AS (
        SELECT id AS user_id, first_name, last_name, email, profile_image_url, created_at
        FROM user_profiles
      ),
      login_agg AS (
        SELECT
          user_id,
          MAX(logged_in_at) AS last_login_at,
          COUNT(*) FILTER (
            WHERE (logged_in_at AT TIME ZONE ${ADMIN_TIME_ZONE})::date =
                  (NOW() AT TIME ZONE ${ADMIN_TIME_ZONE})::date
          )::int AS logins_today,
          MAX(email) FILTER (WHERE email IS NOT NULL AND TRIM(email) <> '') AS last_login_email
        FROM auth_login_events
        GROUP BY user_id
      ),
      pref_agg AS (
        SELECT user_id, share_profile
        FROM user_data_preferences
      )
      SELECT
        au.user_id::int AS id,
        CASE WHEN COALESCE(pf.share_profile, TRUE) THEN pa.first_name ELSE NULL END AS first_name,
        CASE WHEN COALESCE(pf.share_profile, TRUE) THEN pa.last_name ELSE NULL END AS last_name,
        CASE WHEN COALESCE(pf.share_profile, TRUE) THEN COALESCE(pa.email, la.last_login_email) ELSE NULL END AS email,
        CASE WHEN COALESCE(pf.share_profile, TRUE) THEN pa.profile_image_url ELSE NULL END AS profile_image_url,
        la.last_login_at::text AS last_login_at,
        COALESCE(la.logins_today, 0)::int AS logins_today
      FROM all_user_ids au
      LEFT JOIN profile_agg pa ON pa.user_id = au.user_id
      LEFT JOIN login_agg la ON la.user_id = au.user_id
      LEFT JOIN pref_agg pf ON pf.user_id = au.user_id
      ORDER BY la.last_login_at DESC NULLS LAST, pa.created_at DESC NULLS LAST, au.user_id DESC
    `;

    const daily = await sql`
      SELECT
        ((logged_in_at AT TIME ZONE ${ADMIN_TIME_ZONE})::date)::text AS day,
        COUNT(*)::int AS login_count
      FROM auth_login_events
      WHERE (logged_in_at AT TIME ZONE ${ADMIN_TIME_ZONE})::date >=
            ((NOW() AT TIME ZONE ${ADMIN_TIME_ZONE})::date - 13)
      GROUP BY (logged_in_at AT TIME ZONE ${ADMIN_TIME_ZONE})::date
      ORDER BY day DESC
    `;

    return NextResponse.json({ users, daily });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
