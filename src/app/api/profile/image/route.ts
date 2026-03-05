import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { uploadProfileImage, deleteProfileImage } from "@/lib/blob";

async function ensureProfileTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id                    INTEGER PRIMARY KEY DEFAULT 1,
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
}

export async function POST(req: Request) {
  try {
    await ensureProfileTable();
    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    const [existing] = await sql`
      SELECT profile_image_url
      FROM user_profiles
      WHERE id = 1
      LIMIT 1
    `;

    if (!existing) {
      await sql`INSERT INTO user_profiles (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
    }

    if (existing?.profile_image_url) {
      await deleteProfileImage(existing.profile_image_url as string);
    }

    const imageUrl = await uploadProfileImage(file);
    await sql`
      UPDATE user_profiles
      SET profile_image_url = ${imageUrl}
      WHERE id = 1
    `;

    return NextResponse.json({ profile_image_url: imageUrl });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
