import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";

export async function GET(req: Request) {
  const authState = await requireUserId();
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  const { searchParams } = new URL(req.url);
  const weeks = parseInt(searchParams.get("weeks") ?? "12", 10);

  try {
    const entries = await sql`
      SELECT id, logged_at::text, weight_lbs::float, time_of_day, note, created_at::text
      FROM weight_entries
      WHERE user_id = ${userId}
        AND logged_at >= CURRENT_DATE - (${weeks} * INTERVAL '1 week')
      ORDER BY logged_at DESC, created_at ASC
    `;
    return NextResponse.json(entries);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authState = await requireUserId();
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    const body = await req.json();
    const { logged_at, weight_lbs, time_of_day, note } = body;

    if (!weight_lbs || isNaN(Number(weight_lbs))) {
      return NextResponse.json({ error: "weight_lbs is required" }, { status: 400 });
    }

    const [entry] = await sql`
      INSERT INTO weight_entries (user_id, logged_at, weight_lbs, time_of_day, note)
      VALUES (
        ${userId},
        ${logged_at ?? new Date().toISOString().split("T")[0]},
        ${Number(weight_lbs)},
        ${time_of_day ?? null},
        ${note ?? null}
      )
      RETURNING id, logged_at::text, weight_lbs::float, time_of_day, note, created_at::text
    `;

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
