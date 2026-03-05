import { NextResponse } from "next/server";
import sql from "@/lib/db";
import OpenAI from "openai";
import { requireUserId } from "@/lib/route-auth";

function getClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function GET(req: Request) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    const [weightRows, foodRows] = await Promise.all([
      sql`
        SELECT logged_at::date AS day, weight_lbs::float
        FROM weight_entries
        WHERE user_id = ${userId}
          AND logged_at >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY logged_at ASC
      `,
      sql`
        SELECT logged_at::date AS day,
               SUM(calories)::float AS calories,
               SUM(protein_g)::float AS protein_g,
               SUM(carbs_g)::float AS carbs_g,
               SUM(fat_g)::float AS fat_g
        FROM food_log_entries
        WHERE user_id = ${userId}
          AND logged_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY logged_at::date
        ORDER BY day ASC
      `,
    ]);

    if (weightRows.length === 0 && foodRows.length === 0) {
      return NextResponse.json({ summary: "No data logged this week yet — start tracking to get your first summary!" });
    }

    const weightSummary =
      weightRows.length > 0
        ? `Weight logs (last 7 days): ${weightRows
            .map((r: { day: string; weight_lbs: number }) => `${r.day}: ${r.weight_lbs.toFixed(1)} lbs`)
            .join(", ")}`
        : "No weight entries this week.";

    const avgCal =
      foodRows.length > 0
        ? (foodRows.reduce((s: number, r: { calories: number }) => s + r.calories, 0) / foodRows.length).toFixed(0)
        : null;
    const avgProtein =
      foodRows.length > 0
        ? (foodRows.reduce((s: number, r: { protein_g: number }) => s + r.protein_g, 0) / foodRows.length).toFixed(1)
        : null;

    const foodSummary =
      foodRows.length > 0
        ? `Food logged on ${foodRows.length} of 7 days. Average: ${avgCal} kcal/day, ${avgProtein}g protein/day.`
        : "No food logged this week.";

    const prompt = `You are a supportive weight-loss coach. Write a concise (3-5 sentences) weekly summary for this user based on their data. Be encouraging, specific, and give one actionable tip for next week.

Data:
${weightSummary}
${foodSummary}

Keep the tone warm and motivating. Don't use bullet points — write in natural paragraph form.`;

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const summary = response.choices[0].message.content?.trim() ?? "";
    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
