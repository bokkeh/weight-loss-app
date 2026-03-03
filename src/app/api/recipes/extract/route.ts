import { NextResponse } from "next/server";
import OpenAI from "openai";

function getClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function extractOgImage(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m?.[1] ?? null;
}

function extractJsonLd(html: string): string | null {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const data = JSON.parse(b[1]);
      const items: unknown[] = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
      const recipe = items.find((i) => (i as Record<string, unknown>)["@type"] === "Recipe");
      if (recipe) return JSON.stringify(recipe, null, 2);
    } catch { /* skip */ }
  }
  return null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 8000);
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url?.trim()) return NextResponse.json({ error: "url is required" }, { status: 400 });

    const pageRes = await fetch(url.trim(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RecipeExtractor/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!pageRes.ok) throw new Error(`Could not load page (${pageRes.status})`);
    const html = await pageRes.text();

    const imageUrl = extractOgImage(html);
    const jsonLd = extractJsonLd(html);
    const pageText = jsonLd ?? htmlToText(html);

    const prompt = `Extract the recipe from the following ${jsonLd ? "structured recipe JSON-LD data" : "article text"} and return ONLY a valid JSON object.

If nutritional info isn't provided, estimate realistically based on the ingredients and serving size.

Return this exact structure (no markdown, no explanation):
{
  "name": "recipe name",
  "description": "1-2 sentence description",
  "servings": 1,
  "calories": 0,
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0,
  "fiber_g": 0,
  "sodium_mg": 0,
  "ingredients": "- ingredient 1\\n- ingredient 2",
  "instructions": "1. Step one\\n2. Step two",
  "tags": ["tag1", "tag2"]
}

Source:
${pageText}`;

    const response = await getClient().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0].message.content?.trim() ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not extract a recipe from this page");
    const recipe = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ recipe, imageUrl });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
