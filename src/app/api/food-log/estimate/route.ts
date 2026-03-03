import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { estimateMacros, estimateMacrosFromImage } from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    const { text, imageBase64, mimeType, logged_at } = await req.json();
    if (!text?.trim() && !imageBase64) {
      return NextResponse.json({ error: "text or image is required" }, { status: 400 });
    }

    const macros = imageBase64
      ? await estimateMacrosFromImage(imageBase64, mimeType ?? "image/jpeg", text?.trim())
      : await estimateMacros(text.trim());

    const [entry] = await sql`
      INSERT INTO food_log_entries
        (logged_at, meal_type, food_name, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, source)
      VALUES (
        ${logged_at ?? new Date().toISOString().split("T")[0]},
        ${macros.meal_type},
        ${macros.food_name},
        ${macros.serving_size ?? null},
        ${macros.calories},
        ${macros.protein_g},
        ${macros.carbs_g},
        ${macros.fat_g},
        ${macros.fiber_g},
        ${macros.sodium_mg ?? 0},
        'ai_chat'
      )
      RETURNING id, logged_at::text, meal_type, food_name, serving_size,
                calories::float, protein_g::float, carbs_g::float,
                fat_g::float, fiber_g::float, sodium_mg::float, source, recipe_id, created_at::text
    `;

    return NextResponse.json({ entry, macros }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
