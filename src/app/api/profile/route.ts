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
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  } catch (error) {
    console.error("ensureProfileTable failed:", error);
  }
}

export async function GET(req: Request) {
  try {
    const authState = await requireUserId(req);
    if ("response" in authState) return authState.response;
    const { userId } = authState;

    await ensureProfileTable();
    const [profile] = await sql`
      SELECT id, first_name, last_name, email, phone, profile_image_url, dietary_restrictions, created_at::text, updated_at::text
      FROM user_profiles
      WHERE id = ${userId}
      LIMIT 1
    `;
    if (profile) return NextResponse.json(profile);

    const [created] = await sql`
      INSERT INTO user_profiles (id)
      VALUES (${userId})
      RETURNING id, first_name, last_name, email, phone, profile_image_url, dietary_restrictions, created_at::text, updated_at::text
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
    } = body as Record<string, unknown>;

    const restrictions = Array.isArray(dietary_restrictions)
      ? dietary_restrictions.map((v) => String(v).trim()).filter(Boolean)
      : null;

    const [profile] = await sql`
      INSERT INTO user_profiles (id, first_name, last_name, email, phone, dietary_restrictions, profile_image_url)
      VALUES (
        ${userId},
        ${first_name ? String(first_name).trim() : null},
        ${last_name ? String(last_name).trim() : null},
        ${email ? String(email).trim() : null},
        ${phone ? String(phone).trim() : null},
        ${restrictions},
        ${profile_image_url ? String(profile_image_url).trim() : null}
      )
      ON CONFLICT (id) DO UPDATE SET
        first_name = COALESCE(${first_name ? String(first_name).trim() : null}, user_profiles.first_name),
        last_name = COALESCE(${last_name ? String(last_name).trim() : null}, user_profiles.last_name),
        email = COALESCE(${email ? String(email).trim() : null}, user_profiles.email),
        phone = COALESCE(${phone ? String(phone).trim() : null}, user_profiles.phone),
        dietary_restrictions = COALESCE(${restrictions}, user_profiles.dietary_restrictions),
        profile_image_url = COALESCE(${profile_image_url ? String(profile_image_url).trim() : null}, user_profiles.profile_image_url)
      RETURNING id, first_name, last_name, email, phone, profile_image_url, dietary_restrictions, created_at::text, updated_at::text
    `;

    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
