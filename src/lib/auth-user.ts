import sql from "@/lib/db";

let ensuredSchema: Promise<void> | null = null;

async function ensureMultiUserSchemaInternal() {
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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_email_unique
      ON user_profiles (LOWER(email))
      WHERE email IS NOT NULL
  `;

  await sql`INSERT INTO user_profiles (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;

  await sql`ALTER TABLE weight_entries ADD COLUMN IF NOT EXISTS user_id INTEGER`;
  await sql`UPDATE weight_entries SET user_id = 1 WHERE user_id IS NULL`;
  await sql`ALTER TABLE weight_entries ALTER COLUMN user_id SET DEFAULT 1`;
  await sql`ALTER TABLE weight_entries ALTER COLUMN user_id SET NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_weight_entries_user_id ON weight_entries (user_id)`;

  await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS user_id INTEGER`;
  await sql`UPDATE recipes SET user_id = 1 WHERE user_id IS NULL`;
  await sql`ALTER TABLE recipes ALTER COLUMN user_id SET DEFAULT 1`;
  await sql`ALTER TABLE recipes ALTER COLUMN user_id SET NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes (user_id)`;

  await sql`ALTER TABLE food_log_entries ADD COLUMN IF NOT EXISTS user_id INTEGER`;
  await sql`UPDATE food_log_entries SET user_id = 1 WHERE user_id IS NULL`;
  await sql`ALTER TABLE food_log_entries ALTER COLUMN user_id SET DEFAULT 1`;
  await sql`ALTER TABLE food_log_entries ALTER COLUMN user_id SET NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_food_log_entries_user_id ON food_log_entries (user_id)`;

  await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS user_id INTEGER`;
  await sql`UPDATE chat_messages SET user_id = 1 WHERE user_id IS NULL`;
  await sql`ALTER TABLE chat_messages ALTER COLUMN user_id SET DEFAULT 1`;
  await sql`ALTER TABLE chat_messages ALTER COLUMN user_id SET NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages (user_id)`;

  await sql`ALTER TABLE water_log_entries ADD COLUMN IF NOT EXISTS user_id INTEGER`;
  await sql`UPDATE water_log_entries SET user_id = 1 WHERE user_id IS NULL`;
  await sql`ALTER TABLE water_log_entries ALTER COLUMN user_id SET DEFAULT 1`;
  await sql`ALTER TABLE water_log_entries ALTER COLUMN user_id SET NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_water_log_entries_user_id ON water_log_entries (user_id)`;
}

export function ensureMultiUserSchema() {
  if (!ensuredSchema) {
    ensuredSchema = ensureMultiUserSchemaInternal().catch((error) => {
      ensuredSchema = null;
      throw error;
    });
  }
  return ensuredSchema;
}

export async function findUserIdByEmail(email: string): Promise<number | null> {
  await ensureMultiUserSchema();
  const [row] = await sql`
    SELECT id
    FROM user_profiles
    WHERE LOWER(email) = LOWER(${email})
    LIMIT 1
  `;
  return row?.id ? Number(row.id) : null;
}

export async function getOrCreateUserId(params: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  provider?: string | null;
  providerAccountId?: string | null;
}): Promise<number> {
  const {
    email,
    firstName = null,
    lastName = null,
    imageUrl = null,
    provider = null,
    providerAccountId = null,
  } = params;

  await ensureMultiUserSchema();

  if (provider && providerAccountId) {
    const [mapped] = await sql`
      SELECT user_id
      FROM auth_accounts
      WHERE provider = ${provider}
        AND provider_account_id = ${providerAccountId}
      LIMIT 1
    `;
    if (mapped?.user_id) {
      return Number(mapped.user_id);
    }
  }

  const [existing] = await sql`
    SELECT id, first_name, last_name, profile_image_url
    FROM user_profiles
    WHERE LOWER(email) = LOWER(${email})
    LIMIT 1
  `;

  const userId = existing?.id
    ? Number(existing.id)
    : Number(
        (
          await sql`
            INSERT INTO user_profiles (email, first_name, last_name, profile_image_url)
            VALUES (
              ${email},
              ${firstName},
              ${lastName},
              ${imageUrl}
            )
            RETURNING id
          `
        )[0].id
      );

  await sql`
    UPDATE user_profiles
    SET
      email = COALESCE(${email}, email),
      first_name = COALESCE(${firstName}, first_name),
      last_name = COALESCE(${lastName}, last_name),
      profile_image_url = COALESCE(${imageUrl}, profile_image_url)
    WHERE id = ${userId}
  `;

  if (provider && providerAccountId) {
    await sql`
      INSERT INTO auth_accounts (provider, provider_account_id, user_id)
      VALUES (${provider}, ${providerAccountId}, ${userId})
      ON CONFLICT (provider, provider_account_id)
      DO UPDATE SET user_id = EXCLUDED.user_id
    `;
  }

  return userId;
}
