import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { handleApiError, parseJsonBody } from "@/lib/api";
import { localDateStr } from "@/lib/utils";
import { requireUserId } from "@/lib/route-auth";
import { createWaterLogSchema, deleteByIdSchema, isoDateSchema } from "@/lib/validation";

// GET /api/water?date=YYYY-MM-DD  → today's entries
export async function GET(req: Request) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  const { searchParams } = new URL(req.url);
  try {
    const rawDate = searchParams.get("date");
    const date = rawDate ? isoDateSchema.parse(rawDate) : localDateStr();

    const rows = await sql`
      SELECT * FROM water_log_entries
      WHERE user_id = ${userId}
        AND logged_at = ${date}
      ORDER BY created_at ASC
    `;

    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error, "Failed to load water entries");
  }
}

// POST /api/water  → add 8 oz glass
export async function POST(req: Request) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    const body = await parseJsonBody(req, createWaterLogSchema);
    const date = body.logged_at ?? localDateStr();

    const [row] = await sql`
      INSERT INTO water_log_entries (user_id, logged_at, ounces, source)
      VALUES (${userId}, ${date}, ${body.ounces}, ${body.source})
      RETURNING *
    `;

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Failed to create water entry");
  }
}

// DELETE /api/water?id=123  → delete a specific entry (undo)
export async function DELETE(req: Request) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  const { searchParams } = new URL(req.url);
  try {
    const id = deleteByIdSchema.parse({ id: searchParams.get("id") }).id;
    await sql`DELETE FROM water_log_entries WHERE id = ${id} AND user_id = ${userId}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Failed to delete water entry");
  }
}
