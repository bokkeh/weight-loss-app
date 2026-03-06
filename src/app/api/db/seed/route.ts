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
        user_id     INTEGER       NOT NULL DEFAULT 1,
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
        user_id      INTEGER       NOT NULL DEFAULT 1,
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
        user_id      INTEGER       NOT NULL DEFAULT 1,
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

    // Migration: add sodium_mg column if it doesn't exist yet
    await sql`
      ALTER TABLE food_log_entries
        ADD COLUMN IF NOT EXISTS sodium_mg NUMERIC(7,1) NOT NULL DEFAULT 0
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER       NOT NULL DEFAULT 1,
        role         TEXT          NOT NULL CHECK (role IN ('user','model')),
        content      TEXT          NOT NULL,
        food_log_id  INTEGER       REFERENCES food_log_entries(id) ON DELETE SET NULL,
        created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id                    SERIAL PRIMARY KEY,
        first_name            TEXT,
        last_name             TEXT,
        email                 TEXT,
        phone                 TEXT,
        profile_image_url     TEXT,
        dietary_restrictions  TEXT[],
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      INSERT INTO user_profiles (id)
      VALUES (1)
      ON CONFLICT (id) DO NOTHING
    `;

    // Water log table
    await sql`
      CREATE TABLE IF NOT EXISTS water_log_entries (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER       NOT NULL DEFAULT 1,
        logged_at  DATE          NOT NULL DEFAULT CURRENT_DATE,
        ounces     NUMERIC(5,1)  NOT NULL DEFAULT 8,
        source     TEXT          NOT NULL DEFAULT 'sodium_widget',
        created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS auth_accounts (
        id                  SERIAL PRIMARY KEY,
        provider            TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        user_id             INTEGER NOT NULL,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(provider, provider_account_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS auth_login_events (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER NOT NULL,
        email         TEXT,
        provider      TEXT,
        logged_in_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS feature_requests (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER NOT NULL,
        title         TEXT NOT NULL,
        description   TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'open',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_email_unique
        ON user_profiles (LOWER(email))
        WHERE email IS NOT NULL
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_auth_login_events_user_time
        ON auth_login_events (user_id, logged_in_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_feature_requests_user_time
        ON feature_requests (user_id, created_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_water_log_logged_at
        ON water_log_entries (logged_at DESC)
    `;

    await sql`ALTER TABLE weight_entries ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1`;
    await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1`;
    await sql`ALTER TABLE food_log_entries ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1`;
    await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1`;
    await sql`ALTER TABLE water_log_entries ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1`;

    await sql`CREATE INDEX IF NOT EXISTS idx_weight_entries_user_id ON weight_entries (user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes (user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_food_log_entries_user_id ON food_log_entries (user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages (user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_water_log_entries_user_id ON water_log_entries (user_id)`;

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
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'user_profiles_updated_at'
        ) THEN
          CREATE TRIGGER user_profiles_updated_at
            BEFORE UPDATE ON user_profiles
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
