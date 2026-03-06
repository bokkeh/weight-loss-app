import sql from "@/lib/db";

let ensuredSchema: Promise<void> | null = null;

async function syncUserProfileIdSequence() {
  await sql`
    SELECT setval(
      pg_get_serial_sequence('user_profiles', 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 1) FROM user_profiles), 1),
      true
    )
  `;
}

async function insertProfileWithoutSequence(params: {
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}) {
  const { email, firstName, lastName, imageUrl } = params;
  const [inserted] = await sql`
    WITH existing AS (
      SELECT id
      FROM user_profiles
      WHERE LOWER(email) = LOWER(${email})
      LIMIT 1
    ),
    next_id AS (
      SELECT COALESCE(MAX(id), 0) + 1 AS id
      FROM user_profiles
    ),
    inserted AS (
      INSERT INTO user_profiles (id, email, first_name, last_name, profile_image_url)
      SELECT
        next_id.id,
        ${email},
        ${firstName},
        ${lastName},
        ${imageUrl}
      FROM next_id
      WHERE NOT EXISTS (SELECT 1 FROM existing)
      RETURNING id
    )
    SELECT id FROM inserted
    UNION ALL
    SELECT id FROM existing
    LIMIT 1
  `;
  return inserted?.id ? Number(inserted.id) : null;
}

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
    CREATE INDEX IF NOT EXISTS idx_auth_login_events_user_time
      ON auth_login_events (user_id, logged_in_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_feature_requests_user_time
      ON feature_requests (user_id, created_at DESC)
  `;

  // Optional analytics table for sign-in page traffic.
  // Keep auth/profile functional even if this setup fails in constrained DB environments.
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS auth_signin_events (
        id            SERIAL PRIMARY KEY,
        event_type    TEXT NOT NULL,
        provider      TEXT,
        path          TEXT,
        user_agent    TEXT,
        ip_address    TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_auth_signin_events_created
        ON auth_signin_events (created_at DESC)
    `;
  } catch (error) {
    console.error("Optional auth_signin_events setup failed:", error);
  }

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_email_unique
      ON user_profiles (LOWER(email))
      WHERE email IS NOT NULL
  `;

  await sql`INSERT INTO user_profiles (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
  await syncUserProfileIdSequence();

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
  try {
    await ensureMultiUserSchema();
  } catch (error) {
    console.error("findUserIdByEmail: ensureMultiUserSchema failed:", error);
  }
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

  try {
    await ensureMultiUserSchema();
  } catch (error) {
    console.error("getOrCreateUserId: ensureMultiUserSchema failed:", error);
  }

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
    : await (async () => {
        try {
          const insertedId = await insertProfileWithoutSequence({
            email,
            firstName,
            lastName,
            imageUrl,
          });
          if (insertedId) return insertedId;
        } catch (error) {
          const e = error as { code?: string; constraint?: string };
          if (e.code === "23505" && e.constraint === "user_profiles_pkey") {
            // Legacy deployments may still have sequence drift; sync and retry once.
            await syncUserProfileIdSequence();
            const insertedId = await insertProfileWithoutSequence({
              email,
              firstName,
              lastName,
              imageUrl,
            });
            if (insertedId) return insertedId;
          }
        }

        const [byEmail] = await sql`
          SELECT id
          FROM user_profiles
          WHERE LOWER(email) = LOWER(${email})
          LIMIT 1
        `;
        if (byEmail?.id) return Number(byEmail.id);

        throw new Error("Unable to create or locate user profile");
      })();

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

export async function recordLoginEvent(params: {
  userId: number;
  email?: string | null;
  provider?: string | null;
}) {
  const { userId, email = null, provider = null } = params;
  try {
    await ensureMultiUserSchema();
  } catch (error) {
    console.error("recordLoginEvent: ensureMultiUserSchema failed:", error);
  }
  await sql`
    INSERT INTO auth_login_events (user_id, email, provider)
    VALUES (${userId}, ${email}, ${provider})
  `;
}
