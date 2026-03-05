import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { ensureMultiUserSchema } from "@/lib/auth-user";

export async function POST(req: Request) {
  try {
    await ensureMultiUserSchema();
    const body = await req.json().catch(() => ({}));
    const eventType = typeof body?.eventType === "string" ? body.eventType.trim() : "";
    const provider = typeof body?.provider === "string" ? body.provider.trim() : null;
    const path = typeof body?.path === "string" ? body.path.trim() : null;
    const allowed = new Set(["page_view", "oauth_click"]);
    if (!allowed.has(eventType)) {
      return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
    }

    const forwardedFor = req.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent");

    await sql`
      INSERT INTO auth_signin_events (event_type, provider, path, user_agent, ip_address)
      VALUES (${eventType}, ${provider}, ${path}, ${userAgent}, ${ipAddress})
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
