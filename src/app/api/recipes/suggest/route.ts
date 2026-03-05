import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUserId } from "@/lib/route-auth";

let client: OpenAI | null = null;
function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return client;
}

export async function POST(req: Request) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;

  try {
    const { preferences } = await req.json();

    const prompt = `You are a nutrition expert. Suggest 3 healthy recipes${preferences ? ` that are ${preferences}` : ""}.

Return ONLY a valid JSON array — no markdown, no explanation:
[
  {
    "name": "Recipe Name",
    "description": "Brief 1-2 sentence description",
    "servings": 2,
    "calories": 400,
    "protein_g": 35,
    "carbs_g": 30,
    "fat_g": 12,
    "fiber_g": 6,
    "ingredients": "- 1 ingredient\\n- 2nd ingredient\\n...",
    "instructions": "1. Step one\\n2. Step two\\n...",
    "tags": ["high-protein", "healthy"]
  }
]

Rules:
- All macros are per serving, realistic estimates
- ingredients is a newline-separated bullet list
- instructions is numbered steps
- tags are short lowercase strings
- Return exactly 3 recipes, nothing else`;

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices[0].message.content?.trim() ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("OpenAI did not return valid JSON array");
    const recipes = JSON.parse(jsonMatch[0]);

    return NextResponse.json(recipes);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
