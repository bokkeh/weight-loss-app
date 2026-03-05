import { NextResponse } from "next/server";
import sql from "@/lib/db";

function shiftDay(dayStr: string, offset: number): string {
  const [y, m, d] = dayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    // Client passes its local date so streak is correct regardless of server timezone
    const clientToday = searchParams.get("today");

    // Get all unique logged dates from both weight and food log in the last 90 days
    const rows = await sql`
      SELECT DISTINCT logged_at::date::text AS day
      FROM (
        SELECT logged_at FROM weight_entries
        UNION ALL
        SELECT logged_at FROM food_log_entries
      ) combined
      WHERE logged_at >= CURRENT_DATE - INTERVAL '90 days'
      ORDER BY day DESC
    `;

    // Compute streak using client-local YYYY-MM-DD date strings
    const days = rows.map((r: { day: string }) => String(r.day));
    const daySet = new Set(days);
    let streak = 0;

    const todayStr = clientToday ?? new Date().toISOString().split("T")[0];
    const yesterdayStr = shiftDay(todayStr, -1);

    let cursor: string | null = daySet.has(todayStr)
      ? todayStr
      : daySet.has(yesterdayStr)
        ? yesterdayStr
        : null;
    while (cursor && daySet.has(cursor)) {
      streak += 1;
      cursor = shiftDay(cursor, -1);
    }

    // Weekly avg calories (last 7 days relative to client's today)
    const sevenDaysAgoStr = shiftDay(todayStr, -7);

    const calRows = await sql`
      SELECT
        logged_at::date AS day,
        SUM(calories) AS total
      FROM food_log_entries
      WHERE logged_at >= ${sevenDaysAgoStr}::date
      GROUP BY logged_at::date
    `;
    const weeklyAvgCalories =
      calRows.length > 0
        ? calRows.reduce((sum: number, r: { total: string }) => sum + Number(r.total), 0) / calRows.length
        : null;

    return NextResponse.json({ streak, weeklyAvgCalories });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
