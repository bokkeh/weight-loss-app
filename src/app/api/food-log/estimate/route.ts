import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { handleApiError, parseJsonBody } from "@/lib/api";
import { estimateMacros, estimateMacrosFromImage, estimateMacrosFromImages } from "@/lib/gemini";
import { requireUserId } from "@/lib/route-auth";
import { formatFoodName, localDateStr } from "@/lib/utils";
import { foodEstimateSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const authState = await requireUserId(req);
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    const { text, imageBase64, mimeType, images, logged_at } = await parseJsonBody(req, foodEstimateSchema);
    const normalizedImages = Array.isArray(images)
      ? images
          .filter((img: unknown) => {
            if (!img || typeof img !== "object") return false;
            const rec = img as Record<string, unknown>;
            return typeof rec.imageBase64 === "string" && rec.imageBase64.trim().length > 0;
          })
          .map((img: Record<string, unknown>) => ({
            imageBase64: String(img.imageBase64),
            mimeType: typeof img.mimeType === "string" ? img.mimeType : "image/jpeg",
          }))
      : [];
    const hasMultiImages = normalizedImages.length > 0;
    const trimmedText = text?.trim();
    if (!trimmedText && !imageBase64 && !hasMultiImages) {
      return NextResponse.json({ error: "text or image is required" }, { status: 400 });
    }

    const macros = hasMultiImages
      ? await estimateMacrosFromImages(normalizedImages, trimmedText)
      : imageBase64
        ? await estimateMacrosFromImage(imageBase64, mimeType ?? "image/jpeg", trimmedText)
        : await estimateMacros(trimmedText ?? "");
    const normalizedFoodName = formatFoodName(String(macros.food_name ?? ""));
    if (!normalizedFoodName) {
      return NextResponse.json({ error: "Unable to estimate food name" }, { status: 400 });
    }

    const [entry] = await sql`
      INSERT INTO food_log_entries
        (user_id, logged_at, meal_type, food_name, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source)
      VALUES (
        ${userId},
        ${logged_at ?? localDateStr()},
        ${macros.meal_type},
        ${normalizedFoodName},
        ${macros.serving_size ?? null},
        ${macros.calories},
        ${macros.protein_g},
        ${macros.carbs_g},
        ${macros.fat_g},
        ${macros.fiber_g},
        ${macros.sugar_g ?? 0},
        ${macros.sodium_mg ?? 0},
        'ai_chat'
      )
      RETURNING id, logged_at::text, meal_type, food_name, serving_size,
                calories::float, protein_g::float, carbs_g::float,
                fat_g::float, fiber_g::float, sugar_g::float, sodium_mg::float, source, recipe_id, created_at::text
    `;

    return NextResponse.json({ entry, macros }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Failed to estimate and log food");
  }
}
