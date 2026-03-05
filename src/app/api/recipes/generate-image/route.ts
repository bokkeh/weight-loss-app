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
    });

    const first = result.data?.[0];
    let imageDataUrl: string | null = null;

    if (first?.b64_json) {
      imageDataUrl = `data:image/png;base64,${first.b64_json}`;
    } else if (first?.url) {
      const upstream = await fetch(first.url);
      if (upstream.ok) {
        const contentType = upstream.headers.get("content-type") ?? "image/png";
        const buffer = Buffer.from(await upstream.arrayBuffer());
        imageDataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
      }
    }

    if (!imageDataUrl) {
      return NextResponse.json({ error: "Image generation returned no usable image." }, { status: 502 });
    }

    return NextResponse.json({ imageDataUrl });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
