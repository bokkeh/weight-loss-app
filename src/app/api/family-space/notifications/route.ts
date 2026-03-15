import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/route-auth";
import { ensureFamilySchema, listPendingFamilyInvites } from "@/lib/family-space";

export async function GET(req: Request) {
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  try {
    await ensureFamilySchema();
    const invites = await listPendingFamilyInvites(auth.userId);
    return NextResponse.json({
      count: invites.length,
      invites,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
