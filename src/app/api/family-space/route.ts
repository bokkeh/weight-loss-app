import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";
import { findUserIdByEmail } from "@/lib/auth-user";

type Circle = "family" | "extended";

async function ensureFamilySchema() {
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
}

async function getPrimaryFamilyId(userId: number): Promise<number> {
  const [owned] = await sql`
    SELECT id
    FROM family_groups
    WHERE owner_id = ${userId}
    ORDER BY id ASC
    LIMIT 1
  `;
  if (owned?.id) return Number(owned.id);

  const [member] = await sql`
    SELECT family_id
    FROM family_memberships
    WHERE user_id = ${userId}
    ORDER BY id ASC
    LIMIT 1
  `;
  if (member?.family_id) return Number(member.family_id);

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

async function isMember(userId: number, familyId: number): Promise<boolean> {
  const [row] = await sql`
    SELECT id
    FROM family_memberships
    WHERE family_id = ${familyId}
      AND user_id = ${userId}
    LIMIT 1
  `;
  return Boolean(row?.id);
}

function normalizeCircle(value: unknown): Circle {
  return String(value) === "extended" ? "extended" : "family";
}

export async function GET(req: Request) {
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;
  const { userId } = auth;

  try {
    await ensureFamilySchema();
    const familyId = await getPrimaryFamilyId(userId);

    const [family] = await sql`
      SELECT id, owner_id, name, created_at::text
      FROM family_groups
      WHERE id = ${familyId}
      LIMIT 1
    `;

    const members = await sql`
      SELECT
        m.id,
        m.user_id,
        m.circle,
        m.role,
        m.created_at::text,
        p.first_name,
        p.last_name,
        p.email,
        p.profile_image_url
      FROM family_memberships m
      LEFT JOIN user_profiles p ON p.id = m.user_id
      WHERE m.family_id = ${familyId}
      ORDER BY m.circle ASC, m.created_at ASC
    `;

    const invites = await sql`
      SELECT id, email, circle, status, created_at::text, accepted_at::text
      FROM family_invites
      WHERE family_id = ${familyId}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const grocery = await sql`
      SELECT id, name, quantity, checked, created_by, created_at::text
      FROM family_shared_grocery_items
      WHERE family_id = ${familyId}
      ORDER BY checked ASC, created_at DESC
    `;

    const naps = await sql`
      SELECT id, kid_name, nap_date::text, start_time, end_time, notes, created_by, created_at::text
      FROM family_kid_naps
      WHERE family_id = ${familyId}
      ORDER BY nap_date DESC, created_at DESC
      LIMIT 100
    `;

    const [cycle] = await sql`
      SELECT id, partner_name, cycle_start_date::text, cycle_length_days, period_length_days, notes, created_at::text
      FROM family_partner_cycles
      WHERE family_id = ${familyId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return NextResponse.json({
      family,
      members,
      invites,
      grocery,
      naps,
      cycle: cycle ?? null,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;
  const { userId } = auth;

  try {
    await ensureFamilySchema();
    const familyId = await getPrimaryFamilyId(userId);
    if (!(await isMember(userId, familyId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "invite") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
      const circle = normalizeCircle(body.circle);
      const invitedUserId = await findUserIdByEmail(email);

      if (invitedUserId) {
        await sql`
          INSERT INTO family_memberships (family_id, user_id, circle, role)
          VALUES (${familyId}, ${invitedUserId}, ${circle}, 'member')
          ON CONFLICT (family_id, user_id)
          DO UPDATE SET circle = EXCLUDED.circle
        `;
        await sql`
          INSERT INTO family_invites (family_id, email, circle, status, invited_by, accepted_at)
          VALUES (${familyId}, ${email}, ${circle}, 'accepted', ${userId}, NOW())
        `;
      } else {
        await sql`
          INSERT INTO family_invites (family_id, email, circle, status, invited_by)
          VALUES (${familyId}, ${email}, ${circle}, 'pending', ${userId})
        `;
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "add_grocery") {
      const name = String(body.name ?? "").trim();
      const quantity = String(body.quantity ?? "").trim() || null;
      if (!name) return NextResponse.json({ error: "Item name is required." }, { status: 400 });
      const [row] = await sql`
        INSERT INTO family_shared_grocery_items (family_id, name, quantity, created_by)
        VALUES (${familyId}, ${name}, ${quantity}, ${userId})
        RETURNING id, name, quantity, checked, created_by, created_at::text
      `;
      return NextResponse.json(row, { status: 201 });
    }

    if (action === "toggle_grocery") {
      const id = Number(body.id);
      const checked = Boolean(body.checked);
      await sql`
        UPDATE family_shared_grocery_items
        SET checked = ${checked}
        WHERE id = ${id}
          AND family_id = ${familyId}
      `;
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_grocery") {
      const id = Number(body.id);
      await sql`
        DELETE FROM family_shared_grocery_items
        WHERE id = ${id}
          AND family_id = ${familyId}
      `;
      return NextResponse.json({ ok: true });
    }

    if (action === "add_nap") {
      const kidName = String(body.kid_name ?? "").trim();
      const napDate = String(body.nap_date ?? "").trim() || new Date().toISOString().slice(0, 10);
      const startTime = String(body.start_time ?? "").trim() || null;
      const endTime = String(body.end_time ?? "").trim() || null;
      const notes = String(body.notes ?? "").trim() || null;
      if (!kidName) return NextResponse.json({ error: "Kid name is required." }, { status: 400 });
      const [row] = await sql`
        INSERT INTO family_kid_naps (family_id, kid_name, nap_date, start_time, end_time, notes, created_by)
        VALUES (${familyId}, ${kidName}, ${napDate}, ${startTime}, ${endTime}, ${notes}, ${userId})
        RETURNING id, kid_name, nap_date::text, start_time, end_time, notes, created_by, created_at::text
      `;
      return NextResponse.json(row, { status: 201 });
    }

    if (action === "delete_nap") {
      const id = Number(body.id);
      await sql`
        DELETE FROM family_kid_naps
        WHERE id = ${id}
          AND family_id = ${familyId}
      `;
      return NextResponse.json({ ok: true });
    }

    if (action === "save_cycle") {
      const partnerName = String(body.partner_name ?? "").trim() || null;
      const cycleStartDate = String(body.cycle_start_date ?? "").trim();
      const cycleLengthDays = Math.max(21, Math.min(40, Number(body.cycle_length_days) || 28));
      const periodLengthDays = Math.max(2, Math.min(10, Number(body.period_length_days) || 5));
      const notes = String(body.notes ?? "").trim() || null;
      if (!cycleStartDate) {
        return NextResponse.json({ error: "Cycle start date is required." }, { status: 400 });
      }
      const [row] = await sql`
        INSERT INTO family_partner_cycles (
          family_id, partner_name, cycle_start_date, cycle_length_days, period_length_days, notes, created_by
        )
        VALUES (
          ${familyId}, ${partnerName}, ${cycleStartDate}, ${cycleLengthDays}, ${periodLengthDays}, ${notes}, ${userId}
        )
        RETURNING id, partner_name, cycle_start_date::text, cycle_length_days, period_length_days, notes, created_at::text
      `;
      return NextResponse.json(row, { status: 201 });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

