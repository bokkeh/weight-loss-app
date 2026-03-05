import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireAdminUser } from "@/lib/route-auth";

export async function GET() {
  const adminState = await requireAdminUser();
  if ("response" in adminState) return adminState.response;

  try {
    const users = await sql`
      SELECT
        up.id,
        up.first_name,
        up.last_name,
        up.email,
        up.profile_image_url,
        MAX(le.logged_in_at)::text AS last_login_at,
        COUNT(*) FILTER (WHERE le.logged_in_at::date = CURRENT_DATE)::int AS logins_today
      FROM user_profiles up
      LEFT JOIN auth_login_events le ON le.user_id = up.id
      GROUP BY up.id, up.first_name, up.last_name, up.email, up.profile_image_url
      ORDER BY MAX(le.logged_in_at) DESC NULLS LAST, up.created_at DESC
    `;

    const daily = await sql`
      SELECT
        logged_in_at::date::text AS day,
        COUNT(*)::int AS login_count
      FROM auth_login_events
      WHERE logged_in_at >= CURRENT_DATE - INTERVAL '14 days'
      GROUP BY logged_in_at::date
      ORDER BY day DESC
    `;

    return NextResponse.json({ users, daily });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
