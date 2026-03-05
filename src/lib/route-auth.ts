import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ensureMultiUserSchema } from "@/lib/auth-user";
import { getOrCreateUserId } from "@/lib/auth-user";

export async function requireUserId() {
  await ensureMultiUserSchema();
  const session = await getServerSession(authOptions);
  const rawId = session?.user?.id;
  const parsedId = Number(rawId);
  if (Number.isFinite(parsedId) && parsedId > 0) {
    return { userId: parsedId };
  }

  // Fallback for sessions that have email but no mapped id yet.
  const email = session?.user?.email?.trim();
  if (email) {
    const fullName = session?.user?.name ?? "";
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? null;
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
    const userId = await getOrCreateUserId({
      email,
      firstName,
      lastName,
      imageUrl: session?.user?.image ?? null,
      provider: null,
      providerAccountId: null,
    });
    return { userId };
  }

  return {
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}
