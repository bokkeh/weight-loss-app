import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authState = await requireUserId();
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    const [deleted] = await sql`
      DELETE FROM weight_entries
      WHERE id = ${Number(id)}
        AND user_id = ${userId}
      RETURNING id
    `;
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
