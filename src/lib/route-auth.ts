import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ensureMultiUserSchema } from "@/lib/auth-user";
import { getOrCreateUserId } from "@/lib/auth-user";
import { findUserIdByEmail } from "@/lib/auth-user";
import { isAdminEmail } from "@/lib/admin";

export async function requireUserId(_req?: Request) {
  void _req;
  try {
    await ensureMultiUserSchema();
  } catch (error) {
    // Do not block authenticated requests if optional schema migration fails.
    console.error("ensureMultiUserSchema failed:", error);
  }

  try {
    const session = await getServerSession(authOptions);
    const rawId = session?.user?.id;
    const parsedId = Number(rawId);
    if (Number.isFinite(parsedId) && parsedId > 0) {
      return { userId: parsedId };
    }

    // Fallback for sessions that have email but no mapped id yet.
    const email = session?.user?.email?.trim();
    if (email) {
      // Prefer read-only lookup first to avoid write-path failures on constrained DB roles.
      try {
        const existingUserId = await findUserIdByEmail(email);
        if (existingUserId) {
          return { userId: existingUserId };
        }
      } catch (error) {
        console.error("findUserIdByEmail failed:", error);
      }

      const fullName = session?.user?.name ?? "";
      const parts = fullName.trim().split(/\s+/).filter(Boolean);
      const firstName = parts[0] ?? null;
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
      try {
        const userId = await getOrCreateUserId({
          email,
          firstName,
          lastName,
          imageUrl: session?.user?.image ?? null,
          provider: null,
          providerAccountId: null,
        });
        return { userId };
      } catch (error) {
        console.error("getOrCreateUserId failed:", error);
        return {
          response: NextResponse.json(
            { error: "Session is out of sync. Please sign out and sign in again." },
            { status: 401 }
          ),
        };
      }
    }
  } catch (error) {
    console.error("requireUserId resolution failed:", error);
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}

export async function requireAdminUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? null;
  if (!isAdminEmail(email)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const base = await requireUserId();
  if ("response" in base) return base;
  return { ...base, email };
}
