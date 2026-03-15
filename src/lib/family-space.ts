import sql from "@/lib/db";

export type Circle = "family" | "extended";

export interface PendingFamilyInviteNotification {
  id: number;
  family_id: number;
  family_name: string;
  email: string;
  circle: Circle;
  status: "pending";
  created_at: string;
  invited_by: number;
  invited_by_name: string | null;
}

export async function ensureFamilySchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS family_groups (
      id          SERIAL PRIMARY KEY,
      owner_id    INTEGER NOT NULL,
      name        TEXT NOT NULL DEFAULT 'My Family',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS family_memberships (
      id          SERIAL PRIMARY KEY,
      family_id   INTEGER NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL,
      circle      TEXT NOT NULL CHECK (circle IN ('family', 'extended')),
      role        TEXT NOT NULL DEFAULT 'member',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(family_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS family_invites (
      id           SERIAL PRIMARY KEY,
      family_id    INTEGER NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
      email        TEXT NOT NULL,
      circle       TEXT NOT NULL CHECK (circle IN ('family', 'extended')),
      status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
      invited_by   INTEGER NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      accepted_at  TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS family_shared_grocery_items (
      id          SERIAL PRIMARY KEY,
      family_id   INTEGER NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      quantity    TEXT,
      checked     BOOLEAN NOT NULL DEFAULT FALSE,
      created_by  INTEGER NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS family_kid_naps (
      id          SERIAL PRIMARY KEY,
      family_id   INTEGER NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
      kid_name    TEXT NOT NULL,
      nap_date    DATE NOT NULL DEFAULT CURRENT_DATE,
      start_time  TEXT,
      end_time    TEXT,
      notes       TEXT,
      created_by  INTEGER NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS family_partner_cycles (
      id                  SERIAL PRIMARY KEY,
      family_id           INTEGER NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
      partner_name        TEXT,
      cycle_start_date    DATE NOT NULL,
      cycle_length_days   INTEGER NOT NULL DEFAULT 28,
      period_length_days  INTEGER NOT NULL DEFAULT 5,
      notes               TEXT,
      created_by          INTEGER NOT NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS family_id INTEGER`;
}

export async function getUserEmail(userId: number): Promise<string | null> {
  const [row] = await sql`
    SELECT email
    FROM user_profiles
    WHERE id = ${userId}
    LIMIT 1
  `;
  const email = String(row?.email ?? "").trim().toLowerCase();
  return email || null;
}

export async function getPrimaryFamilyId(userId: number): Promise<number> {
  const [member] = await sql`
    SELECT family_id
    FROM family_memberships
    WHERE user_id = ${userId}
    ORDER BY (role = 'owner') ASC, created_at DESC
    LIMIT 1
  `;
  if (member?.family_id) return Number(member.family_id);

  const [owned] = await sql`
    SELECT id
    FROM family_groups
    WHERE owner_id = ${userId}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `;
  if (owned?.id) return Number(owned.id);

  const [created] = await sql`
    INSERT INTO family_groups (owner_id, name)
    VALUES (${userId}, 'My Family')
    RETURNING id
  `;
  const familyId = Number(created.id);
  await sql`
    INSERT INTO family_memberships (family_id, user_id, circle, role)
    VALUES (${familyId}, ${userId}, 'family', 'owner')
    ON CONFLICT (family_id, user_id) DO NOTHING
  `;
  return familyId;
}

export async function isFamilyMember(userId: number, familyId: number): Promise<boolean> {
  const [row] = await sql`
    SELECT id
    FROM family_memberships
    WHERE family_id = ${familyId}
      AND user_id = ${userId}
    LIMIT 1
  `;
  return Boolean(row?.id);
}

export async function listPendingFamilyInvites(userId: number): Promise<PendingFamilyInviteNotification[]> {
  const email = await getUserEmail(userId);
  if (!email) return [];

  const rows = await sql`
    SELECT
      fi.id,
      fi.family_id,
      fg.name AS family_name,
      fi.email,
      fi.circle,
      fi.status,
      fi.created_at::text,
      fi.invited_by,
      NULLIF(TRIM(CONCAT(COALESCE(inviter.first_name, ''), ' ', COALESCE(inviter.last_name, ''))), '') AS invited_by_name
    FROM family_invites fi
    INNER JOIN family_groups fg ON fg.id = fi.family_id
    LEFT JOIN user_profiles inviter ON inviter.id = fi.invited_by
    WHERE LOWER(fi.email) = LOWER(${email})
      AND fi.status = 'pending'
      AND NOT EXISTS (
        SELECT 1
        FROM family_memberships fm
        WHERE fm.family_id = fi.family_id
          AND fm.user_id = ${userId}
      )
    ORDER BY fi.created_at DESC
    LIMIT 20
  `;

  return rows as PendingFamilyInviteNotification[];
}
