import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a knowledgeable, friendly nutrition and diet assistant helping someone track their weight loss journey.

When the user describes food they have eaten or asks you to log food, you MUST include a structured JSON block in your response using this exact format on its own line:

<<<FOOD_LOG>>>
{
  "food_name": "descriptive food name",
  "serving_size": "e.g. 1 cup, 200g, 2 slices",
  "calories": 0,
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0,
  "fiber_g": 0,
  "sugar_g": 0,
  "sodium_mg": 0,
  "meal_type": "breakfast"
}
<<<END_FOOD_LOG>>>

Rules for the JSON block:
- Only include this block when the user explicitly mentions eating, having eaten, or wants to log food
- meal_type must be one of: breakfast, lunch, dinner, snack
- All numeric values must be realistic estimates based on nutritional databases
- For homemade or ambiguous foods, provide reasonable estimates
- Do NOT include this block for general nutrition questions or advice

For all other nutrition questions (meal planning, diet advice, calorie goals, recipes, macro guidance), respond normally without the JSON block.

Always be encouraging, evidence-based, and supportive of the user's weight loss goals.`;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export interface FoodLogPayload {
  food_name: string;
  serving_size?: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
}

export interface VisionImageInput {
  imageBase64: string;
  mimeType: string;
}

export async function sendChatMessage(
  message: string,
  history: { role: string; content: string }[],
  foodLogContext?: string,
  images?: VisionImageInput[]
): Promise<string> {
  const systemContent = foodLogContext
    ? `${SYSTEM_PROMPT}\n\n${foodLogContext}`
    : SYSTEM_PROMPT;

  const trimmedMessage = message.trim();
  const hasImages = Array.isArray(images) && images.length > 0;

  const userContent: OpenAI.Chat.ChatCompletionMessageParam["content"] = hasImages
    ? [
        ...(trimmedMessage ? ([{ type: "text", text: trimmedMessage }] as const) : []),
        ...images.map((image) => ({
          type: "image_url" as const,
          image_url: {
            url: `data:${image.mimeType};base64,${image.imageBase64}`,
            detail: "low" as const,
          },
        })),
      ]
    : trimmedMessage;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...history.map((m) => ({
      role: (m.role === "model" ? "assistant" : m.role) as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userContent },
  ];

  const response = await getClient().chat.completions.create({
    model: hasImages ? "gpt-4o" : "gpt-4o-mini",
    messages,
  });

  return response.choices[0].message.content ?? "";
}

export function parseFoodLogBlock(text: string): FoodLogPayload | null {
  const match = text.match(/<<<FOOD_LOG>>>([\s\S]*?)<<<END_FOOD_LOG>>>/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as FoodLogPayload;
    const validMealTypes = ["breakfast", "lunch", "dinner", "snack"];
    if (!validMealTypes.includes(parsed.meal_type)) {
      parsed.meal_type = "snack";
    }
    return parsed;
  } catch {
    return null;
  }
}

export function stripFoodLogBlock(text: string): string {
  return text.replace(/<<<FOOD_LOG>>>[\s\S]*?<<<END_FOOD_LOG>>>/g, "").trim();
}

export async function estimateMacrosFromImage(
  imageBase64: string,
  mimeType: string,
  textHint?: string
): Promise<FoodLogPayload> {
  const prompt = `${textHint ? `Context: ${textHint}\n\n` : ""}You are a nutrition database. Look at this food image and estimate the macros for what you see.

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "food_name": "descriptive name",
  "serving_size": "estimated amount with unit",
  "calories": 0,
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0,
  "fiber_g": 0,
  "sugar_g": 0,
  "sodium_mg": 0,
  "meal_type": "snack"
}

meal_type must be one of: breakfast, lunch, dinner, snack. Use snack if unclear.
All numbers must be realistic estimates based on what you see. Return only the JSON, nothing else.`;

  const response = await getClient().chat.completions.create({
    model: "gpt-4o",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "low" },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const text = response.choices[0].message.content?.trim() ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("OpenAI did not return valid JSON");
  const parsed = JSON.parse(jsonMatch[0]) as FoodLogPayload;
  const validMealTypes = ["breakfast", "lunch", "dinner", "snack"];
  if (!validMealTypes.includes(parsed.meal_type)) parsed.meal_type = "snack";
  return parsed;
}

export async function estimateMacrosFromImages(
  images: VisionImageInput[],
  textHint?: string
): Promise<FoodLogPayload> {
  if (images.length === 0) {
    throw new Error("At least one image is required.");
  }

  const prompt = `${textHint ? `Context: ${textHint}\n\n` : ""}You are a nutrition database. Estimate total macros for the meal shown across all uploaded images.

Treat all photos as one meal context. Avoid double-counting if images are different angles of the same plate.

Return ONLY a valid JSON object:
{
  "food_name": "descriptive name",
  "serving_size": "estimated total amount with unit",
  "calories": 0,
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0,
  "fiber_g": 0,
  "sugar_g": 0,
  "sodium_mg": 0,
  "meal_type": "snack"
}

meal_type must be one of: breakfast, lunch, dinner, snack. Use snack if unclear.
All numbers must be realistic estimates. Return only the JSON.`;

  const content: OpenAI.Chat.ChatCompletionContentPart[] = [
    ...images.map((image) => ({
      type: "image_url" as const,
      image_url: { url: `data:${image.mimeType};base64,${image.imageBase64}`, detail: "low" as const },
    })),
    { type: "text", text: prompt },
  ];

  const response = await getClient().chat.completions.create({
    model: "gpt-4o",
    max_tokens: 350,
    messages: [{ role: "user", content }],
  });

  const text = response.choices[0].message.content?.trim() ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("OpenAI did not return valid JSON");
  const parsed = JSON.parse(jsonMatch[0]) as FoodLogPayload;
  const validMealTypes = ["breakfast", "lunch", "dinner", "snack"];
  if (!validMealTypes.includes(parsed.meal_type)) parsed.meal_type = "snack";
  return parsed;
}

export async function estimateMacros(description: string): Promise<FoodLogPayload> {
  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `You are a nutrition database. Estimate the macros for: "${description}"

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "food_name": "descriptive name",
  "serving_size": "amount with unit",
  "calories": 0,
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0,
  "fiber_g": 0,
  "sodium_mg": 0,
  "meal_type": "snack"
}

meal_type must be one of: breakfast, lunch, dinner, snack. Use snack if unclear.
All numbers must be realistic estimates. Return only the JSON, nothing else.`,
      },
    ],
  });

  const text = response.choices[0].message.content?.trim() ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("OpenAI did not return valid JSON");
  const parsed = JSON.parse(jsonMatch[0]) as FoodLogPayload;
  const validMealTypes = ["breakfast", "lunch", "dinner", "snack"];
  if (!validMealTypes.includes(parsed.meal_type)) parsed.meal_type = "snack";
  return parsed;
}
