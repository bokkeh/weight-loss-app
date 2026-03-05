import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { localDateStr } from "@/lib/utils";
import { requireUserId } from "@/lib/route-auth";

// GET /api/water?date=YYYY-MM-DD  → today's entries
export async function GET(req: Request) {
  const authState = await requireUserId();
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? localDateStr();

  const rows = await sql`
    SELECT * FROM water_log_entries
    WHERE user_id = ${userId}
      AND logged_at = ${date}
    ORDER BY created_at ASC
  `;

  return NextResponse.json(rows);
}

// POST /api/water  → add 8 oz glass
export async function POST(req: Request) {
  const authState = await requireUserId();
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  const body = await req.json().catch(() => ({}));
  const date: string = body.logged_at ?? localDateStr();
  const ounces: number = Number(body.ounces ?? 8);
  const source: string = body.source ?? "sodium_widget";

  const [row] = await sql`
    INSERT INTO water_log_entries (user_id, logged_at, ounces, source)
    VALUES (${userId}, ${date}, ${ounces}, ${source})
    RETURNING *
  `;

  return NextResponse.json(row, { status: 201 });
}

// DELETE /api/water?id=123  → delete a specific entry (undo)
export async function DELETE(req: Request) {
  const authState = await requireUserId();
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await sql`DELETE FROM water_log_entries WHERE id = ${Number(id)} AND user_id = ${userId}`;
  return NextResponse.json({ success: true });
}
