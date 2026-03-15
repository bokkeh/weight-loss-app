import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/route-auth";
import { findUserIdByEmail } from "@/lib/auth-user";
import {
  ensureFamilySchema,
  getPrimaryFamilyId,
  getUserEmail,
  isFamilyMember,
  listPendingFamilyInvites,
  type Circle,
} from "@/lib/family-space";

function normalizeCircle(value: unknown): Circle {
  return String(value) === "extended" ? "extended" : "family";
}

function isValidTimeValue(value: string | null): boolean {
  if (!value) return false;
  return /^\d{2}:\d{2}$/.test(value);
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
      current_user_id: userId,
      family,
      members,
      invites,
      pending_invites: await listPendingFamilyInvites(userId),
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
    if (!(await isFamilyMember(userId, familyId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "invite") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
      const circle = normalizeCircle(body.circle);
      const currentUserEmail = await getUserEmail(userId);
      if (currentUserEmail && email === currentUserEmail) {
        return NextResponse.json({ error: "You cannot invite your own account." }, { status: 400 });
      }

      const invitedUserId = await findUserIdByEmail(email);
      if (invitedUserId && (await isFamilyMember(invitedUserId, familyId))) {
        return NextResponse.json({ ok: true, message: "That account is already in this family space." });
      }

      const [existingPending] = await sql`
        SELECT id
        FROM family_invites
        WHERE family_id = ${familyId}
          AND LOWER(email) = LOWER(${email})
          AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (existingPending?.id) {
        return NextResponse.json({ ok: true, message: "An invite is already pending for that email." });
      }

      await sql`
        INSERT INTO family_invites (family_id, email, circle, status, invited_by)
        VALUES (${familyId}, ${email}, ${circle}, 'pending', ${userId})
      `;

      return NextResponse.json({
        ok: true,
        message: invitedUserId
          ? "Invite sent. They can accept it from their Family Space notifications."
          : "Invite saved. Once that account signs up with this email, it can accept the invite from Family Space.",
      });
    }

    if (action === "accept_invite") {
      const inviteId = Number(body.invite_id);
      if (!Number.isFinite(inviteId) || inviteId <= 0) {
        return NextResponse.json({ error: "Invite id is required." }, { status: 400 });
      }

      const currentUserEmail = await getUserEmail(userId);
      if (!currentUserEmail) {
        return NextResponse.json(
          { error: "Your account needs an email before it can accept family invites." },
          { status: 400 }
        );
      }

      const [invite] = await sql`
        SELECT id, family_id, circle
        FROM family_invites
        WHERE id = ${inviteId}
          AND LOWER(email) = LOWER(${currentUserEmail})
          AND status = 'pending'
        LIMIT 1
      `;
      if (!invite?.id) {
        return NextResponse.json({ error: "Invite not found." }, { status: 404 });
      }

      await sql`
        INSERT INTO family_memberships (family_id, user_id, circle, role)
        VALUES (${invite.family_id}, ${userId}, ${invite.circle}, 'member')
        ON CONFLICT (family_id, user_id)
        DO UPDATE SET circle = EXCLUDED.circle
      `;
      await sql`
        UPDATE family_invites
        SET status = 'accepted', accepted_at = NOW()
        WHERE id = ${inviteId}
      `;
      await sql`
        UPDATE grocery_items
        SET family_id = ${invite.family_id}
        WHERE user_id = ${userId}
          AND family_id IS DISTINCT FROM ${invite.family_id}
      `;

      return NextResponse.json({
        ok: true,
        message: "Invite accepted. You now have access to the shared family grocery list.",
      });
    }

    if (action === "decline_invite") {
      const inviteId = Number(body.invite_id);
      if (!Number.isFinite(inviteId) || inviteId <= 0) {
        return NextResponse.json({ error: "Invite id is required." }, { status: 400 });
      }

      const currentUserEmail = await getUserEmail(userId);
      if (!currentUserEmail) {
        return NextResponse.json(
          { error: "Your account needs an email before it can manage family invites." },
          { status: 400 }
        );
      }

      const [invite] = await sql`
        SELECT id
        FROM family_invites
        WHERE id = ${inviteId}
          AND LOWER(email) = LOWER(${currentUserEmail})
          AND status = 'pending'
        LIMIT 1
      `;
      if (!invite?.id) {
        return NextResponse.json({ error: "Invite not found." }, { status: 404 });
      }

      await sql`
        UPDATE family_invites
        SET status = 'declined'
        WHERE id = ${inviteId}
      `;
      return NextResponse.json({ ok: true, message: "Invite declined." });
    }

    if (action === "cancel_invite") {
      const inviteId = Number(body.invite_id);
      if (!Number.isFinite(inviteId) || inviteId <= 0) {
        return NextResponse.json({ error: "Invite id is required." }, { status: 400 });
      }

      const [family] = await sql`
        SELECT owner_id
        FROM family_groups
        WHERE id = ${familyId}
        LIMIT 1
      `;
      if (Number(family?.owner_id) !== userId) {
        return NextResponse.json({ error: "Only the family owner can cancel invites." }, { status: 403 });
      }

      const [invite] = await sql`
        SELECT id
        FROM family_invites
        WHERE id = ${inviteId}
          AND family_id = ${familyId}
          AND status = 'pending'
        LIMIT 1
      `;
      if (!invite?.id) {
        return NextResponse.json({ error: "Pending invite not found." }, { status: 404 });
      }

      await sql`
        DELETE FROM family_invites
        WHERE id = ${inviteId}
      `;
      return NextResponse.json({ ok: true, message: "Pending invite canceled." });
    }

    if (action === "remove_member") {
      const memberUserId = Number(body.member_user_id);
      if (!Number.isFinite(memberUserId) || memberUserId <= 0) {
        return NextResponse.json({ error: "Member user id is required." }, { status: 400 });
      }

      const [family] = await sql`
        SELECT owner_id
        FROM family_groups
        WHERE id = ${familyId}
        LIMIT 1
      `;
      if (Number(family?.owner_id) !== userId) {
        return NextResponse.json({ error: "Only the family owner can remove members." }, { status: 403 });
      }
      if (memberUserId === userId) {
        return NextResponse.json({ error: "The family owner cannot remove themselves." }, { status: 400 });
      }

      const [member] = await sql`
        SELECT id
        FROM family_memberships
        WHERE family_id = ${familyId}
          AND user_id = ${memberUserId}
        LIMIT 1
      `;
      if (!member?.id) {
        return NextResponse.json({ error: "Member not found." }, { status: 404 });
      }

      await sql`
        DELETE FROM family_memberships
        WHERE family_id = ${familyId}
          AND user_id = ${memberUserId}
      `;
      await sql`
        UPDATE grocery_items
        SET family_id = NULL
        WHERE user_id = ${memberUserId}
          AND family_id = ${familyId}
      `;
      return NextResponse.json({ ok: true, message: "Family member removed." });
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
      if ((startTime && !isValidTimeValue(startTime)) || (endTime && !isValidTimeValue(endTime))) {
        return NextResponse.json(
          { error: "Start and end times must use HH:MM format." },
          { status: 400 }
        );
      }
      if (startTime && endTime && startTime >= endTime) {
        return NextResponse.json(
          { error: "End time must be later than start time." },
          { status: 400 }
        );
      }
      if (startTime && endTime) {
        const [overlap] = await sql`
          SELECT id
          FROM family_kid_naps
          WHERE family_id = ${familyId}
            AND LOWER(TRIM(kid_name)) = LOWER(TRIM(${kidName}))
            AND nap_date = ${napDate}
            AND start_time IS NOT NULL
            AND end_time IS NOT NULL
            AND ${startTime} < end_time
            AND ${endTime} > start_time
          LIMIT 1
        `;
        if (overlap?.id) {
          return NextResponse.json(
            { error: "This nap overlaps an existing nap for that child." },
            { status: 409 }
          );
        }
      }
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
