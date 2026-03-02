import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function POST(req: Request) {
  const secret = req.headers.get("x-seed-secret");
  if (secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS weight_entries (
        id          SERIAL PRIMARY KEY,
        logged_at   DATE          NOT NULL DEFAULT CURRENT_DATE,
        weight_lbs  NUMERIC(6,2)  NOT NULL CHECK (weight_lbs > 0),
        note        TEXT,
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_weight_entries_logged_at
        ON weight_entries (logged_at DESC)
    `;

    // Migration: add time_of_day column if it doesn't exist yet
    await sql`
      ALTER TABLE weight_entries
        ADD COLUMN IF NOT EXISTS time_of_day TEXT
          CHECK (time_of_day IN ('morning', 'evening'))
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS recipes (
        id           SERIAL PRIMARY KEY,
        name         TEXT          NOT NULL,
        description  TEXT,
        servings     INTEGER       NOT NULL DEFAULT 1,
        calories     NUMERIC(7,2)  NOT NULL DEFAULT 0,
        protein_g    NUMERIC(6,2)  NOT NULL DEFAULT 0,
        carbs_g      NUMERIC(6,2)  NOT NULL DEFAULT 0,
        fat_g        NUMERIC(6,2)  NOT NULL DEFAULT 0,
        fiber_g      NUMERIC(6,2)  NOT NULL DEFAULT 0,
        ingredients  TEXT,
        instructions TEXT,
        image_url    TEXT,
        tags         TEXT[],
        created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS food_log_entries (
        id           SERIAL PRIMARY KEY,
        logged_at    DATE          NOT NULL DEFAULT CURRENT_DATE,
        meal_type    TEXT          CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
        food_name    TEXT          NOT NULL,
        serving_size TEXT,
        calories     NUMERIC(7,2)  NOT NULL DEFAULT 0,
        protein_g    NUMERIC(6,2)  NOT NULL DEFAULT 0,
        carbs_g      NUMERIC(6,2)  NOT NULL DEFAULT 0,
        fat_g        NUMERIC(6,2)  NOT NULL DEFAULT 0,
        fiber_g      NUMERIC(6,2)  NOT NULL DEFAULT 0,
        source       TEXT          DEFAULT 'manual' CHECK (source IN ('manual','ai_chat','recipe')),
        recipe_id    INTEGER       REFERENCES recipes(id) ON DELETE SET NULL,
        created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_food_log_logged_at
        ON food_log_entries (logged_at DESC)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id           SERIAL PRIMARY KEY,
        role         TEXT          NOT NULL CHECK (role IN ('user','model')),
        content      TEXT          NOT NULL,
        food_log_id  INTEGER       REFERENCES food_log_entries(id) ON DELETE SET NULL,
        created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'recipes_updated_at'
        ) THEN
          CREATE TRIGGER recipes_updated_at
            BEFORE UPDATE ON recipes
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END;
      $$
    `;

    return NextResponse.json({ success: true, message: "Database tables created successfully" });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Failed to run migrations", details: String(error) },
      { status: 500 }
    );
  }
}
