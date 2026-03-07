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
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You convert grocery requests into a concise shopping checklist. Return only valid JSON with this shape: {\"items\":[{\"name\":\"string\",\"quantity\":\"string or empty\"}]}",
        },
        {
          role: "user",
          content: `Expand this grocery request into a practical shopping list with short item names and optional quantity: ${prompt}`,
        },
      ],
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI did not return valid JSON." }, { status: 500 });
    }
    const parsed = JSON.parse(jsonMatch[0]) as { items?: Array<{ name?: string; quantity?: string }> };
    const normalized = (parsed.items ?? [])
      .map((item) => ({
        name: String(item.name ?? "").trim(),
        quantity: String(item.quantity ?? "").trim(),
      }))
      .filter((item) => item.name.length > 0)
      .slice(0, 60);

    return NextResponse.json({ items: normalized });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
