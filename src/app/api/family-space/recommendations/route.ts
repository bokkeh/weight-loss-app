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
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const weekOfCycle = Math.max(1, Math.min(6, Number(body.week_of_cycle) || 1));
    const partnerName = String(body.partner_name ?? "your partner").trim();
    const notes = String(body.notes ?? "").trim();

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You are a supportive partner coach. Provide practical, empathetic suggestions tailored to menstrual cycle context. Keep it concise and non-medical. Return JSON only with this shape: {\"summary\":\"string\",\"tips\":[\"string\"],\"avoid\":[\"string\"]}.",
        },
        {
          role: "user",
          content: `Context:
- Cycle week: ${weekOfCycle}
- Partner: ${partnerName}
- Additional notes: ${notes || "none"}

Give 5 support tips and 3 things to avoid.`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI did not return valid JSON." }, { status: 500 });
    }
    const parsed = JSON.parse(jsonMatch[0]) as {
      summary?: string;
      tips?: string[];
      avoid?: string[];
    };
    return NextResponse.json({
      summary: String(parsed.summary ?? "Ways to show up this week"),
      tips: Array.isArray(parsed.tips) ? parsed.tips.map((t) => String(t)).slice(0, 8) : [],
      avoid: Array.isArray(parsed.avoid) ? parsed.avoid.map((t) => String(t)).slice(0, 5) : [],
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

