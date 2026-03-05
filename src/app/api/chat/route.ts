import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";
import {
  sendChatMessage,
  parseFoodLogBlock,
  stripFoodLogBlock,
} from "@/lib/gemini";

export async function GET() {
  const authState = await requireUserId();
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    const messages = await sql`
      SELECT id, role, content, food_log_id, created_at::text
      FROM chat_messages
      WHERE user_id = ${userId}
      ORDER BY created_at ASC
      LIMIT 100
    `;
    return NextResponse.json(messages);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authState = await requireUserId();
  if ("response" in authState) return authState.response;
  const { userId } = authState;

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
      WHERE user_id = ${userId}
      ORDER BY created_at ASC
      LIMIT 40
    `;

    // Fetch today's food log for context
    const today = new Date().toISOString().split("T")[0];
    const todayFood = await sql`
      SELECT food_name, serving_size, calories::float, protein_g::float,
             carbs_g::float, fat_g::float, meal_type
      FROM food_log_entries
      WHERE user_id = ${userId}
        AND logged_at = ${today}
      ORDER BY created_at ASC
    `;

    // Fetch recent weight entries for context
    const recentWeight = await sql`
      SELECT logged_at::text, weight_lbs::float, time_of_day
      FROM weight_entries
      WHERE user_id = ${userId}
        AND logged_at >= CURRENT_DATE - INTERVAL '14 days'
      ORDER BY logged_at DESC, created_at ASC
      LIMIT 20
    `;

    let weightContext = "";
    if (recentWeight.length > 0) {
      const lines = (recentWeight as Record<string, unknown>[]).map((e) =>
        `- ${e.logged_at}${e.time_of_day ? ` (${e.time_of_day})` : ""}: ${Number(e.weight_lbs).toFixed(1)} lbs`
      );
      weightContext = `\n\nRecent weight log (last 14 days):\n${lines.join("\n")}`;
    }

    let foodLogContext = `Today's food log (${today}):`;
    if (todayFood.length === 0) {
      foodLogContext += " No entries logged yet.";
    } else {
      const lines = (todayFood as Record<string, unknown>[]).map((e) =>
        `- ${e.food_name}${e.serving_size ? ` (${e.serving_size})` : ""}: ${Math.round(Number(e.calories))} cal, ${Number(e.protein_g).toFixed(1)}g protein, ${Number(e.carbs_g).toFixed(1)}g carbs, ${Number(e.fat_g).toFixed(1)}g fat [${e.meal_type}]`
      );
      const totals = (todayFood as Record<string, unknown>[]).reduce(
        (acc: { cal: number; p: number; c: number; f: number }, e) => ({
          cal: acc.cal + Number(e.calories),
          p: acc.p + Number(e.protein_g),
          c: acc.c + Number(e.carbs_g),
          f: acc.f + Number(e.fat_g),
        }),
        { cal: 0, p: 0, c: 0, f: 0 }
      );
      foodLogContext += `\n${lines.join("\n")}\nDaily totals so far: ${Math.round(totals.cal)} cal, ${totals.p.toFixed(1)}g protein, ${totals.c.toFixed(1)}g carbs, ${totals.f.toFixed(1)}g fat`;
    }

    const rawReply = await sendChatMessage(
      message,
      history as { role: string; content: string }[],
      foodLogContext + weightContext
    );

    const foodPayload = parseFoodLogBlock(rawReply);
    const cleanReply = stripFoodLogBlock(rawReply);

    let foodLogEntry = null;

    if (foodPayload) {
      const today = new Date().toISOString().split("T")[0];
      const [entry] = await sql`
        INSERT INTO food_log_entries
          (user_id, logged_at, meal_type, food_name, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, source)
        VALUES (
          ${userId},
          ${today},
          ${foodPayload.meal_type},
          ${foodPayload.food_name},
          ${foodPayload.serving_size ?? null},
          ${foodPayload.calories},
          ${foodPayload.protein_g},
          ${foodPayload.carbs_g},
          ${foodPayload.fat_g},
          ${foodPayload.fiber_g},
          ${foodPayload.sodium_mg ?? 0},
          'ai_chat'
        )
        RETURNING id, logged_at::text, meal_type, food_name, serving_size,
                  calories::float, protein_g::float, carbs_g::float,
                  fat_g::float, fiber_g::float, sodium_mg::float, source, recipe_id, created_at::text
      `;
      foodLogEntry = entry;

      // Save user message
      await sql`
        INSERT INTO chat_messages (user_id, role, content) VALUES (${userId}, 'user', ${message})
      `;

      // Save model response linked to food log
      await sql`
        INSERT INTO chat_messages (user_id, role, content, food_log_id)
        VALUES (${userId}, 'model', ${cleanReply}, ${entry.id})
      `;
    } else {
      // Save user message
      await sql`
        INSERT INTO chat_messages (user_id, role, content) VALUES (${userId}, 'user', ${message})
      `;

      // Save model response
      await sql`
        INSERT INTO chat_messages (user_id, role, content) VALUES (${userId}, 'model', ${cleanReply})
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
  const authState = await requireUserId();
  if ("response" in authState) return authState.response;
  const { userId } = authState;

  try {
    await sql`DELETE FROM chat_messages WHERE user_id = ${userId}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
