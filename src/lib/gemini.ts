import { GoogleGenerativeAI } from "@google/generative-ai";

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

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

export function getChatModel() {
  return getGenAI().getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_PROMPT,
  });
}

export interface FoodLogPayload {
  food_name: string;
  serving_size?: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
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

export async function estimateMacros(description: string): Promise<FoodLogPayload> {
  const model = getGenAI().getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `You are a nutrition database. Estimate the macros for: "${description}"

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "food_name": "descriptive name",
  "serving_size": "amount with unit",
  "calories": 0,
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0,
  "fiber_g": 0,
  "meal_type": "snack"
}

meal_type must be one of: breakfast, lunch, dinner, snack. Use snack if unclear.
All numbers must be realistic estimates. Return only the JSON, nothing else.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini did not return valid JSON");
  const parsed = JSON.parse(jsonMatch[0]) as FoodLogPayload;
  const validMealTypes = ["breakfast", "lunch", "dinner", "snack"];
  if (!validMealTypes.includes(parsed.meal_type)) parsed.meal_type = "snack";
  return parsed;
}
