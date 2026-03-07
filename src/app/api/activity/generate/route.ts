import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUserId } from "@/lib/route-auth";

let client: OpenAI | null = null;

function getClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export async function POST(req: Request) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const windowHours = Number(body.window_hours ?? 72);
    const intensity = String(body.intensity ?? "moderate");
    const insights = Array.isArray(body.insights) ? body.insights.map((v) => String(v)).slice(0, 5) : [];
    const topFoods = Array.isArray(body.top_foods)
      ? body.top_foods
          .map((v) => {
            const item = v as Record<string, unknown>;
            return String(item.food_name ?? "").trim();
          })
          .filter(Boolean)
          .slice(0, 4)
      : [];

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are an expert trainer for fat-loss and general health. Return only valid JSON matching: {\"title\":\"string\",\"duration_min\":number,\"equipment\":\"bodyweight|dumbbells|mixed\",\"focus\":\"string\",\"checklist\":[\"string\"],\"notes\":\"string\"}. Keep checklist 5-8 concise actions. Prefer bodyweight and dumbbells.",
        },
        {
          role: "user",
          content: `Build one workout for this user context:
- Window: last ${windowHours} hours
- Readiness intensity: ${intensity}
- Recent insights: ${insights.join(" | ") || "none"}
- Recent foods: ${topFoods.join(", ") || "none"}

Output JSON only.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI did not return valid JSON." }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      title?: string;
      duration_min?: number;
      equipment?: "bodyweight" | "dumbbells" | "mixed";
      focus?: string;
      checklist?: string[];
      notes?: string;
    };

    const checklist = Array.isArray(parsed.checklist)
      ? parsed.checklist.map((item) => String(item).trim()).filter(Boolean).slice(0, 10)
      : [];

    if (!parsed.title || checklist.length === 0) {
      return NextResponse.json({ error: "AI returned an incomplete workout." }, { status: 500 });
    }

    return NextResponse.json({
      title: String(parsed.title),
      duration_min: Number(parsed.duration_min) > 0 ? Math.round(Number(parsed.duration_min)) : 30,
      equipment: ["bodyweight", "dumbbells", "mixed"].includes(String(parsed.equipment))
        ? parsed.equipment
        : "mixed",
      focus: String(parsed.focus ?? "AI-generated workout"),
      notes: String(parsed.notes ?? ""),
      checklist,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

