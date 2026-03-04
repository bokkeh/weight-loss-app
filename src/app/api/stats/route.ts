import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    // Client passes its local date so streak is correct regardless of server timezone
    const clientToday = searchParams.get("today");

    // Get all unique logged dates from both weight and food log in the last 90 days
    const rows = await sql`
      SELECT DISTINCT logged_at::date AS day
      FROM (
        SELECT logged_at FROM weight_entries
        UNION ALL
        SELECT logged_at FROM food_log_entries
      ) combined
      WHERE logged_at >= CURRENT_DATE - INTERVAL '90 days'
      ORDER BY day DESC
    `;

    // Compute streak using client's local date (falls back to server UTC if not provided)
    const days = rows.map((r: { day: string }) => r.day as string).sort().reverse();
    let streak = 0;

    const todayStr = clientToday ?? new Date().toISOString().split("T")[0];
    const todayDate = new Date(todayStr + "T12:00:00"); // noon avoids DST edge cases
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split("T")[0];

    if (days.length > 0 && (days[0] === todayStr || days[0] === yesterdayStr)) {
      const startOffset = days[0] === todayStr ? 0 : 1;
      for (let i = 0; i < days.length; i++) {
        const expected = new Date(todayDate);
        expected.setDate(expected.getDate() - (i + startOffset));
        const expectedStr = expected.toISOString().split("T")[0];
        if (days[i] === expectedStr) {
          streak++;
        } else {
          break;
        }
      }
    }

    // Weekly avg calories (last 7 days relative to client's today)
    const sevenDaysAgo = new Date(todayDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

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
