import { NextResponse } from "next/server";
import sql from "@/lib/db";
import {
  getChatModel,
  parseFoodLogBlock,
  stripFoodLogBlock,
} from "@/lib/gemini";

export async function GET() {
  try {
    const messages = await sql`
      SELECT id, role, content, food_log_id, created_at::text
      FROM chat_messages
      ORDER BY created_at ASC
      LIMIT 100
    `;
    return NextResponse.json(messages);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message } = body as { message: string };

    if (!message?.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    // Load chat history for context
    const history = await sql`
      SELECT role, content
      FROM chat_messages
      ORDER BY created_at ASC
      LIMIT 40
    `;

    const model = getChatModel();

    // Build Gemini-format history
    const geminiHistory = (history as { role: string; content: string }[]).map((m) => ({
      role: m.role as "user" | "model",
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(message);
    const rawReply = result.response.text();

    const foodPayload = parseFoodLogBlock(rawReply);
    const cleanReply = stripFoodLogBlock(rawReply);

    let foodLogEntry = null;

    if (foodPayload) {
      const today = new Date().toISOString().split("T")[0];
      const [entry] = await sql`
        INSERT INTO food_log_entries
          (logged_at, meal_type, food_name, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, source)
        VALUES (
          ${today},
          ${foodPayload.meal_type},
          ${foodPayload.food_name},
          ${foodPayload.serving_size ?? null},
          ${foodPayload.calories},
          ${foodPayload.protein_g},
          ${foodPayload.carbs_g},
          ${foodPayload.fat_g},
          ${foodPayload.fiber_g},
          'ai_chat'
        )
        RETURNING id, logged_at::text, meal_type, food_name, serving_size,
                  calories::float, protein_g::float, carbs_g::float,
                  fat_g::float, fiber_g::float, source, recipe_id, created_at::text
      `;
      foodLogEntry = entry;

      // Save user message
      await sql`
        INSERT INTO chat_messages (role, content) VALUES ('user', ${message})
      `;

      // Save model response linked to food log
      await sql`
        INSERT INTO chat_messages (role, content, food_log_id)
        VALUES ('model', ${cleanReply}, ${entry.id})
      `;
    } else {
      // Save user message
      await sql`
        INSERT INTO chat_messages (role, content) VALUES ('user', ${message})
      `;

      // Save model response
      await sql`
        INSERT INTO chat_messages (role, content) VALUES ('model', ${cleanReply})
      `;
    }

    return NextResponse.json({
      reply: cleanReply,
      foodLogged: foodLogEntry,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await sql`DELETE FROM chat_messages`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
