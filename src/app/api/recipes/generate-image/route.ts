import { NextResponse } from "next/server";
import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const ingredients = String(body.ingredients ?? "").trim();
    const instructions = String(body.instructions ?? "").trim();

    if (!name && !ingredients) {
      return NextResponse.json(
        { error: "Provide at least a recipe name or ingredients." },
        { status: 400 }
      );
    }

    const prompt = [
      "Create a realistic food photo for this recipe.",
      "Style: clean natural lighting, appetizing plating, no text, no labels, no watermark.",
      name ? `Recipe name: ${name}` : "",
      description ? `Description: ${description}` : "",
      ingredients ? `Ingredients: ${ingredients}` : "",
      instructions ? `Preparation context: ${instructions.slice(0, 800)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await getClient().images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      response_format: "b64_json",
    });

    const first = result.data?.[0];
    const b64 = first?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: "Image generation returned no image." }, { status: 502 });
    }

    return NextResponse.json({ imageDataUrl: `data:image/png;base64,${b64}` });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

