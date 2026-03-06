import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";
import { requireAdminUser } from "@/lib/route-auth";

async function ensureFeatureRequestsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS feature_requests (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL,
      title         TEXT NOT NULL,
      description   TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'open',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_feature_requests_user_time
      ON feature_requests (user_id, created_at DESC)
  `;
}

export async function GET(req: Request) {
  const adminState = await requireAdminUser();
  if ("response" in adminState) {
    const userState = await requireUserId(req);
    if ("response" in userState) return userState.response;
    const { userId } = userState;
    try {
      await ensureFeatureRequestsTable();
      const mine = await sql`
        SELECT id, user_id, title, description, status, created_at::text
        FROM feature_requests
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;
      return NextResponse.json(mine);
    } catch (error) {
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }
  }

  try {
    await ensureFeatureRequestsTable();
    const all = await sql`
      SELECT
        fr.id,
        fr.user_id,
        fr.title,
        fr.description,
        fr.status,
        fr.created_at::text,
        up.first_name,
        up.last_name,
        up.email
      FROM feature_requests fr
      LEFT JOIN user_profiles up ON up.id = fr.user_id
      ORDER BY fr.created_at DESC
    `;
    return NextResponse.json(all);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    await ensureFeatureRequestsTable();
    const body = await req.json().catch(() => ({}));
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();

    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }

    const [created] = await sql`
      INSERT INTO feature_requests (user_id, title, description)
      VALUES (${userId}, ${title}, ${description})
      RETURNING id, user_id, title, description, status, created_at::text
    `;

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
