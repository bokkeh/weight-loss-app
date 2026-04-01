import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { handleApiError, parseJsonBody } from "@/lib/api";
import { requireUserId } from "@/lib/route-auth";
import { localDateStr } from "@/lib/utils";
import { createWeightEntrySchema } from "@/lib/validation";

export async function GET(req: Request) {
  const authState = await requireUserId(req);
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
    return handleApiError(error, "Failed to load weight entries");
  }
}

export async function POST(req: Request) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    const body = await parseJsonBody(req, createWeightEntrySchema);

    const [entry] = await sql`
      INSERT INTO weight_entries (user_id, logged_at, weight_lbs, time_of_day, note)
      VALUES (
        ${userId},
        ${body.logged_at ?? localDateStr()},
        ${body.weight_lbs},
        ${body.time_of_day ?? null},
        ${body.note ?? null}
      )
      RETURNING id, logged_at::text, weight_lbs::float, time_of_day, note, created_at::text
    `;

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Failed to create weight entry");
  }
}
