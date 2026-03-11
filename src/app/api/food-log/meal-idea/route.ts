import { NextResponse } from "next/server";
import OpenAI from "openai";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";

interface MacroGoals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
}

interface FoodRow {
  food_name: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack" | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
}

const DEFAULT_GOALS: MacroGoals = {
  calories: 2100,
  protein_g: 180,
  carbs_g: 180,
  fat_g: 65,
  fiber_g: 30,
  sodium_mg: 2300,
};

let client: OpenAI | null = null;

function getClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

function targetMealForHour(hour: number): "breakfast" | "lunch" | "dinner" | "snack" {
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

function sumMacros(entries: FoodRow[]) {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + Number(e.calories),
      protein_g: acc.protein_g + Number(e.protein_g),
      carbs_g: acc.carbs_g + Number(e.carbs_g),
      fat_g: acc.fat_g + Number(e.fat_g),
      fiber_g: acc.fiber_g + Number(e.fiber_g),
      sodium_mg: acc.sodium_mg + Number(e.sodium_mg),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0 }
  );
}

function fallbackIdeas(nextMeal: string, remaining: ReturnType<typeof sumMacros>): string[] {
  const ideas: string[] = [];
  const mealLabel = nextMeal.charAt(0).toUpperCase() + nextMeal.slice(1);
  if (remaining.calories <= 120) {
    ideas.push("You are close to your calorie target. Keep the next option very light and protein-aware.");
  } else if (remaining.protein_g > 30) {
    ideas.push(`${mealLabel} idea: prioritize lean protein first, then add produce and a moderate carb.`);
  } else {
    ideas.push(`${mealLabel} idea: build a balanced plate that fits your remaining calories and sodium.`);
  }
  ideas.push(
    `Remaining today: ${remaining.calories.toFixed(0)} kcal, ${remaining.protein_g.toFixed(0)}g protein, ${remaining.carbs_g.toFixed(0)}g carbs, ${remaining.fat_g.toFixed(0)}g fat.`
  );
  ideas.push("If still hungry after dinner, use a small protein-forward snack rather than a high-sodium option.");
  return ideas;
}

export async function POST(req: Request) {
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;
  const { userId } = auth;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const date = String(body.date ?? new Date().toISOString().slice(0, 10));
    const currentHour = Math.max(0, Math.min(23, Number(body.current_hour ?? new Date().getHours())));
    const rawGoals = (body.goals ?? {}) as Partial<MacroGoals>;
    const goals: MacroGoals = {
      calories: Number(rawGoals.calories ?? DEFAULT_GOALS.calories),
      protein_g: Number(rawGoals.protein_g ?? DEFAULT_GOALS.protein_g),
      carbs_g: Number(rawGoals.carbs_g ?? DEFAULT_GOALS.carbs_g),
      fat_g: Number(rawGoals.fat_g ?? DEFAULT_GOALS.fat_g),
      fiber_g: Number(rawGoals.fiber_g ?? DEFAULT_GOALS.fiber_g),
      sodium_mg: Number(rawGoals.sodium_mg ?? DEFAULT_GOALS.sodium_mg),
    };

    const todayEntries = (await sql`
      SELECT
        food_name,
        meal_type,
        calories::float AS calories,
        protein_g::float AS protein_g,
        carbs_g::float AS carbs_g,
        fat_g::float AS fat_g,
        fiber_g::float AS fiber_g,
        sodium_mg::float AS sodium_mg
      FROM food_log_entries
      WHERE user_id = ${userId}
        AND logged_at = ${date}
      ORDER BY created_at ASC
    `) as FoodRow[];

    const recentEntries = (await sql`
      SELECT
        food_name,
        meal_type,
        calories::float AS calories,
        protein_g::float AS protein_g,
        carbs_g::float AS carbs_g,
        fat_g::float AS fat_g,
        fiber_g::float AS fiber_g,
        sodium_mg::float AS sodium_mg
      FROM food_log_entries
      WHERE user_id = ${userId}
        AND logged_at >= (${date}::date - INTERVAL '3 days')
        AND logged_at <= ${date}::date
      ORDER BY logged_at DESC, created_at DESC
      LIMIT 140
    `) as FoodRow[];

    const totals = sumMacros(todayEntries);
    const remaining = {
      calories: Math.max(0, goals.calories - totals.calories),
      protein_g: Math.max(0, goals.protein_g - totals.protein_g),
      carbs_g: Math.max(0, goals.carbs_g - totals.carbs_g),
      fat_g: Math.max(0, goals.fat_g - totals.fat_g),
      fiber_g: Math.max(0, goals.fiber_g - totals.fiber_g),
      sodium_mg: Math.max(0, goals.sodium_mg - totals.sodium_mg),
    };

    const mealOrder: Array<"breakfast" | "lunch" | "dinner" | "snack"> = ["breakfast", "lunch", "dinner", "snack"];
    const baseMeal = targetMealForHour(currentHour);
    const mealSet = new Set(todayEntries.map((e) => e.meal_type).filter(Boolean));
    let nextMeal: "breakfast" | "lunch" | "dinner" | "snack" = baseMeal;
    if (mealSet.has(baseMeal)) {
      const idx = mealOrder.indexOf(baseMeal);
      const fallback = mealOrder.slice(idx + 1).find((m) => !mealSet.has(m));
      if (fallback) nextMeal = fallback;
    }

    const topFoods = Array.from(
      recentEntries.reduce((map, e) => {
        const key = e.food_name.trim().toLowerCase();
        map.set(key, (map.get(key) ?? 0) + 1);
        return map;
      }, new Map<string, number>())
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => `${name} (${count}x)`);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ideas: fallbackIdeas(nextMeal, remaining), source: "fallback" });
    }

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You are a nutrition coach. Return only valid JSON: {\"ideas\":[\"...\"]}. Provide exactly 4 concise suggestions. Make them practical, specific, and macro-aware. Avoid medical claims.",
        },
        {
          role: "user",
          content: `Create next meal ideas for today.
Target meal window: ${nextMeal}
Macros remaining today:
- calories: ${remaining.calories.toFixed(0)} kcal
- protein: ${remaining.protein_g.toFixed(1)} g
- carbs: ${remaining.carbs_g.toFixed(1)} g
- fat: ${remaining.fat_g.toFixed(1)} g
- fiber: ${remaining.fiber_g.toFixed(1)} g
- sodium budget left: ${remaining.sodium_mg.toFixed(0)} mg

Top foods from the user's last ~72h:
${topFoods.join(", ") || "none"}

Current day totals so far:
- calories: ${totals.calories.toFixed(0)} / ${goals.calories.toFixed(0)}
- protein: ${totals.protein_g.toFixed(1)} / ${goals.protein_g.toFixed(1)}
- carbs: ${totals.carbs_g.toFixed(1)} / ${goals.carbs_g.toFixed(1)}
- fat: ${totals.fat_g.toFixed(1)} / ${goals.fat_g.toFixed(1)}
- fiber: ${totals.fiber_g.toFixed(1)} / ${goals.fiber_g.toFixed(1)}
- sodium: ${totals.sodium_mg.toFixed(0)} / ${goals.sodium_mg.toFixed(0)}

Rules:
- Prioritize suggestions that help close the biggest remaining macro gaps.
- Mention specific food choices or pairings.
- Include at least one low-effort option.
- Keep each idea to 1 sentence.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ ideas: fallbackIdeas(nextMeal, remaining), source: "fallback" });
    }
    const parsed = JSON.parse(jsonMatch[0]) as { ideas?: unknown[] };
    const ideas = Array.isArray(parsed.ideas)
      ? parsed.ideas.map((v) => String(v).trim()).filter(Boolean).slice(0, 6)
      : [];

    if (ideas.length === 0) {
      return NextResponse.json({ ideas: fallbackIdeas(nextMeal, remaining), source: "fallback" });
    }

    return NextResponse.json({ ideas, source: "ai" });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
