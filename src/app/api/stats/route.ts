import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET() {
  try {
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

    // Compute streak: consecutive days ending today or yesterday
    const days = rows.map((r: { day: string }) => r.day as string).sort().reverse();
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];
    const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().split("T")[0];

    if (days.length > 0 && (days[0] === todayStr || days[0] === yesterdayStr)) {
      // startOffset: 0 if most recent log is today, 1 if yesterday
      const startOffset = days[0] === todayStr ? 0 : 1;
      for (let i = 0; i < days.length; i++) {
        const expected = new Date(today);
        expected.setDate(expected.getDate() - (i + startOffset));
        const expectedStr = expected.toISOString().split("T")[0];
        if (days[i] === expectedStr) {
          streak++;
        } else {
          break;
        }
      }
    }

    // Weekly avg calories (last 7 days)
    const calRows = await sql`
      SELECT
        logged_at::date AS day,
        SUM(calories) AS total
      FROM food_log_entries
      WHERE logged_at >= CURRENT_DATE - INTERVAL '7 days'
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
