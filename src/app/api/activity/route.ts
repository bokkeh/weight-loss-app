import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";
import { DEFAULT_MACRO_GOALS, goalsFromProfile } from "@/lib/goals";

type IntensityLevel = "low" | "moderate" | "high";

interface WorkoutPlan {
  title: string;
  duration_min: number;
  level: IntensityLevel;
  equipment: "bodyweight" | "dumbbells" | "mixed";
  reason: string;
  moves: string[];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function buildPlans(level: IntensityLevel): WorkoutPlan[] {
  if (level === "low") {
    return [
      {
        title: "Recovery Walk + Mobility",
        duration_min: 25,
        level,
        equipment: "bodyweight",
        reason: "Lower-readiness day: keep movement gentle and consistent.",
        moves: [
          "15 min easy walk",
          "2 rounds: 8 cat-cow + 8 world's greatest stretch/side",
          "2 rounds: 10 glute bridges + 20s plank hold",
        ],
      },
      {
        title: "Light Dumbbell Primer",
        duration_min: 20,
        level,
        equipment: "dumbbells",
        reason: "Adds light strength stimulus without overloading recovery.",
        moves: [
          "3 rounds: 10 goblet squats (light)",
          "3 rounds: 10 dumbbell rows/side",
          "3 rounds: 8 overhead press + 20s dead bug hold",
        ],
      },
    ];
  }

  if (level === "moderate") {
    return [
      {
        title: "Bodyweight Conditioning Circuit",
        duration_min: 30,
        level,
        equipment: "bodyweight",
        reason: "Balanced day: moderate effort to build consistency.",
        moves: [
          "4 rounds: 12 squats",
          "4 rounds: 10 push-ups (or incline)",
          "4 rounds: 10 reverse lunges/side",
          "4 rounds: 25s plank + 45s rest",
        ],
      },
      {
        title: "Dumbbell Full-Body",
        duration_min: 35,
        level,
        equipment: "dumbbells",
        reason: "Supports muscle retention while you manage calories.",
        moves: [
          "4 sets: 8-10 dumbbell Romanian deadlifts",
          "4 sets: 8-10 dumbbell floor press",
          "4 sets: 10 dumbbell split squats/side",
          "3 sets: 12 dumbbell rows/side",
        ],
      },
    ];
  }

  return [
    {
      title: "Progressive Dumbbell Strength",
      duration_min: 40,
      level,
      equipment: "dumbbells",
      reason: "High-readiness window: good time for progressive overload.",
      moves: [
        "5 sets: 6-8 goblet squats (challenging load)",
        "4 sets: 8-10 dumbbell bench/floor press",
        "4 sets: 8-10 one-arm rows/side",
        "3 sets: 10 Romanian deadlifts + 10 split squats/side",
      ],
    },
    {
      title: "Bodyweight Intervals",
      duration_min: 24,
      level,
      equipment: "bodyweight",
      reason: "Use this if you want a faster session with no equipment.",
      moves: [
        "8 rounds: 30s fast step-ups/high knees + 60s walk",
        "3 rounds: 12 push-ups + 16 alternating lunges + 30s hollow hold",
        "5 min cool-down walk",
      ],
    },
  ];
}

export async function GET(req: Request) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    const startDate = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [foodAgg] = await sql`
      SELECT
        COUNT(*)::int AS entries,
        COUNT(DISTINCT logged_at)::int AS active_days,
        COALESCE(SUM(calories), 0)::float AS calories_total,
        COALESCE(SUM(protein_g), 0)::float AS protein_total,
        COALESCE(SUM(carbs_g), 0)::float AS carbs_total,
        COALESCE(SUM(fat_g), 0)::float AS fat_total
      FROM food_log_entries
      WHERE user_id = ${userId}
        AND logged_at >= ${startDate}::date
    `;

    const [waterAgg] = await sql`
      SELECT
        COALESCE(SUM(ounces), 0)::float AS ounces_total,
        COUNT(DISTINCT logged_at)::int AS active_days
      FROM water_log_entries
      WHERE user_id = ${userId}
        AND logged_at >= ${startDate}::date
    `;

    const topFoods = await sql`
      SELECT
        food_name,
        COUNT(*)::int AS times
      FROM food_log_entries
      WHERE user_id = ${userId}
        AND logged_at >= ${startDate}::date
      GROUP BY food_name
      ORDER BY times DESC, MAX(logged_at) DESC
      LIMIT 3
    ` as Array<{ food_name: string; times: number }>;

    const [profile] = await sql`
      SELECT
        calorie_goal::float,
        protein_goal_g::float,
        carbs_goal_g::float,
        fat_goal_g::float,
        fiber_goal_g::float,
        sodium_goal_mg::float
      FROM user_profiles
      WHERE id = ${userId}
      LIMIT 1
    `;

    const goals = goalsFromProfile(profile ?? DEFAULT_MACRO_GOALS);
    const foodDays = Math.max(Number(foodAgg?.active_days ?? 0), 1);
    const avgCalories = Number(foodAgg?.calories_total ?? 0) / foodDays;
    const avgProtein = Number(foodAgg?.protein_total ?? 0) / foodDays;
    const avgWater = Number(waterAgg?.ounces_total ?? 0) / 3;
    const activeDays = Number(foodAgg?.active_days ?? 0);

    const calorieRatio = goals.calories > 0 ? avgCalories / goals.calories : 1;
    const proteinRatio = goals.protein_g > 0 ? avgProtein / goals.protein_g : 1;
    const hydrationRatio = avgWater / 80;
    const consistencyRatio = activeDays / 3;

    const calorieScore = 1 - clamp(Math.abs(1 - calorieRatio), 0, 1);
    const proteinScore = clamp(proteinRatio, 0, 1);
    const hydrationScore = clamp(hydrationRatio, 0, 1);
    const consistencyScore = clamp(consistencyRatio, 0, 1);

    const readiness = Math.round(
      (calorieScore * 0.35 + proteinScore * 0.3 + hydrationScore * 0.25 + consistencyScore * 0.1) * 100
    );

    let intensity: IntensityLevel = "low";
    if (readiness >= 75) intensity = "high";
    else if (readiness >= 45) intensity = "moderate";

    const insights: string[] = [];
    if (proteinRatio < 0.75) {
      insights.push("Protein has been low over the last 72 hours. Keep sessions shorter and emphasize recovery.");
    }
    if (hydrationRatio < 0.8) {
      insights.push("Hydration is behind target. Add 16-24 oz water pre-workout and keep intensity moderate.");
    }
    if (calorieRatio < 0.75) {
      insights.push("Calorie intake is well below goal. Favor bodyweight or lighter dumbbell work today.");
    } else if (calorieRatio > 1.15) {
      insights.push("Calories are above target. A longer walk or interval finisher can help balance energy intake.");
    }
    if (insights.length === 0) {
      insights.push("Nutrition and hydration look stable. This is a good window for progressive training.");
    }

    return NextResponse.json({
      window_hours: 72,
      readiness,
      intensity,
      metrics: {
        avg_calories_per_day: round1(avgCalories),
        avg_protein_g_per_day: round1(avgProtein),
        avg_water_oz_per_day: round1(avgWater),
        active_days: activeDays,
      },
      goals,
      top_foods: topFoods,
      insights,
      recommendations: buildPlans(intensity),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

