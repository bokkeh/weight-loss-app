import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ensureMultiUserSchema } from "@/lib/auth-user";

export async function requireUserId() {
  await ensureMultiUserSchema();
  const session = await getServerSession(authOptions);
  const rawId = session?.user?.id;
  const userId = Number(rawId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { userId };
}
