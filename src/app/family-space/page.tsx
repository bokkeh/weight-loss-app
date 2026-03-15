"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Baby,
  BellRing,
  Check,
  Clock3,
  HeartHandshake,
  Shield,
  Trash2,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";

type Circle = "family" | "extended";

interface FamilyInfo {
  id: number;
  owner_id: number;
  name: string;
  created_at: string;
}

interface FamilyMember {
  id: number;
  user_id: number;
  circle: Circle;
  role: string;
  created_at?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  profile_image_url?: string;
}

interface Invite {
  id: number;
  email: string;
  circle: Circle;
  status: string;
  created_at: string;
  accepted_at?: string | null;
}

interface PendingInviteNotification {
  id: number;
  family_id: number;
  family_name: string;
  email: string;
  circle: Circle;
  status: "pending";
  created_at: string;
  invited_by: number;
  invited_by_name?: string | null;
}

interface NapLog {
  id: number;
  kid_name: string;
  nap_date: string;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string | null;
}

interface PartnerCycle {
  id: number;
  partner_name?: string | null;
  cycle_start_date: string;
  cycle_length_days: number;
  period_length_days: number;
  notes?: string | null;
}

interface FamilySpaceData {
  current_user_id: number;
  family: FamilyInfo;
  members: FamilyMember[];
  invites: Invite[];
  pending_invites: PendingInviteNotification[];
  naps: NapLog[];
  cycle: PartnerCycle | null;
}

function calcCycleWeek(cycle: PartnerCycle | null): number | null {
  if (!cycle) return null;
  const start = new Date(`${cycle.cycle_start_date}T12:00:00`);
  const now = new Date();
  const daysSince = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000));
  const dayInCycle = (daysSince % Math.max(1, cycle.cycle_length_days)) + 1;
  return Math.min(6, Math.max(1, Math.ceil(dayInCycle / 7)));
}

function formatCycleDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function cycleWeekLabel(week: number | null): string {
  switch (week) {
    case 1:
      return "Reset and recovery";
    case 2:
      return "Energy building";
    case 3:
      return "Strong and steady";
    case 4:
      return "Sensitivity rising";
    case 5:
      return "Extra support week";
    case 6:
      return "Late-cycle care";
    default:
      return "No cycle data yet";
  }
}

function getMemberLabel(member: FamilyMember): string {
  return `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.email || `User ${member.user_id}`;
}

export default function FamilySpacePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<FamilySpaceData | null>(null);
  const [tips, setTips] = useState<{ summary: string; tips: string[]; avoid: string[] } | null>(null);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCircle, setInviteCircle] = useState<Circle>("family");

  const [kidName, setKidName] = useState("");
  const [napDate, setNapDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [napNotes, setNapNotes] = useState("");

  const [partnerName, setPartnerName] = useState("");
  const [cycleStart, setCycleStart] = useState("");
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [cycleNotes, setCycleNotes] = useState("");

  const generateCycleTips = useCallback(async () => {
    const week = calcCycleWeek(data?.cycle ?? null);
    if (!week) return;
    setTipsLoading(true);
    try {
      const res = await fetch("/api/family-space/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_of_cycle: week,
          partner_name: partnerName || "your partner",
          notes: cycleNotes,
        }),
      });
      const parsed = (await res.json().catch(() => null)) as { summary: string; tips: string[]; avoid: string[] } | null;
      if (res.ok && parsed) setTips(parsed);
    } finally {
      setTipsLoading(false);
    }
  }, [cycleNotes, data?.cycle, partnerName]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/family-space");
      const parsed = (await res.json().catch(() => null)) as FamilySpaceData | null;
      if (res.ok && parsed) {
        setData(parsed);
        if (parsed.cycle) {
          setPartnerName(parsed.cycle.partner_name ?? "");
          setCycleStart(parsed.cycle.cycle_start_date ?? "");
          setCycleLength(parsed.cycle.cycle_length_days ?? 28);
          setPeriodLength(parsed.cycle.period_length_days ?? 5);
          setCycleNotes(parsed.cycle.notes ?? "");
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!data?.cycle || tips || tipsLoading) return;
    generateCycleTips().catch(() => undefined);
  }, [data?.cycle, generateCycleTips, tips, tipsLoading]);

  async function runAction(payload: Record<string, unknown>) {
    setSaving(true);
    setActionMessage("");
    try {
      const res = await fetch("/api/family-space", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = await res.text().catch(() => "");
      let parsed: { error?: string; message?: string } = {};
      try {
        parsed = raw ? (JSON.parse(raw) as { error?: string; message?: string }) : {};
      } catch {
        parsed = {};
      }
      if (!res.ok) {
        setActionMessage(parsed.error ?? "Unable to save family update.");
        return false;
      }
      if (parsed.message) setActionMessage(parsed.message);
      await load();
      return true;
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Unable to save family update.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const acceptedInvites = useMemo(
    () => (data?.invites ?? []).filter((invite) => invite.status === "accepted"),
    [data]
  );
  const sentPendingInvites = useMemo(
    () => (data?.invites ?? []).filter((invite) => invite.status === "pending"),
    [data]
  );
  const declinedInvites = useMemo(
    () => (data?.invites ?? []).filter((invite) => invite.status === "declined"),
    [data]
  );
  const cycleWeek = calcCycleWeek(data?.cycle ?? null);
  const ownerId = data?.family?.owner_id ?? null;
  const isOwner = Boolean(ownerId && data?.current_user_id === ownerId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Family Space</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage who is in your family space, who is still pending, and what access each person has.
        </p>
      </div>

      {loading || !data ? (
        <div className="space-y-3">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Family Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Accepted Members</p>
                  <p className="mt-1 text-2xl font-semibold">{data.members.length}</p>
                </div>
                <div className="rounded-lg border bg-amber-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-amber-700">Pending Invites</p>
                  <p className="mt-1 text-2xl font-semibold text-amber-900">{sentPendingInvites.length}</p>
                </div>
                <div className="rounded-lg border bg-emerald-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-emerald-700">Accepted Invites</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-900">{acceptedInvites.length}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-[1fr_170px_auto] gap-2">
                <Input
                  placeholder="Invite by email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <Select value={inviteCircle} onValueChange={(v) => setInviteCircle(v as Circle)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="family">Family Circle</SelectItem>
                    <SelectItem value="extended">Extended Family</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  disabled={saving || !inviteEmail.trim()}
                  onClick={async () => {
                    const ok = await runAction({ action: "invite", email: inviteEmail.trim(), circle: inviteCircle });
                    if (ok) setInviteEmail("");
                  }}
                >
                  <UserPlus className="mr-1 h-4 w-4" />
                  Invite
                </Button>
              </div>

              {actionMessage ? <p className="text-sm text-muted-foreground">{actionMessage}</p> : null}

              {data.pending_invites.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <BellRing className="h-4 w-4 text-amber-700" />
                    <p className="text-sm font-semibold text-amber-900">Invites waiting for your response</p>
                  </div>
                  <div className="space-y-2">
                    {data.pending_invites.map((invite) => (
                      <div key={invite.id} className="rounded-lg border border-amber-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Join {invite.family_name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {invite.invited_by_name || "A family member"} invited you to the{" "}
                              <span className="capitalize">{invite.circle}</span> circle.
                            </p>
                          </div>
                          <Badge variant="outline" className="border-amber-300 text-amber-800">Needs response</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={saving}
                            onClick={() => runAction({ action: "accept_invite", invite_id: invite.id })}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => runAction({ action: "decline_invite", invite_id: invite.id })}
                          >
                            <X className="mr-1 h-3.5 w-3.5" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">People with access</p>
                      <p className="text-xs text-muted-foreground">Accepted and already inside this family space.</p>
                    </div>
                    {isOwner && (
                      <Badge variant="secondary">
                        <Shield className="mr-1 h-3 w-3" />
                        Owner controls
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 space-y-2">
                    {data.members.map((member) => {
                      const removable = isOwner && member.role !== "owner";
                      return (
                        <div key={member.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">{getMemberLabel(member)}</p>
                              <Badge variant={member.role === "owner" ? "default" : "outline"}>
                                {member.role === "owner" ? "Owner" : "Accepted"}
                              </Badge>
                              <Badge variant="outline" className="capitalize">{member.circle}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {member.email || "No email on file"} {"\u00b7"} Joined {formatShortDate(member.created_at)}
                            </p>
                          </div>
                          {removable ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={saving}
                              onClick={() => runAction({ action: "remove_member", member_user_id: member.user_id })}
                            >
                              <UserX className="mr-1 h-3.5 w-3.5" />
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold">Pending and recent invites</p>
                    <p className="text-xs text-muted-foreground">See who is still waiting, who joined, and who declined.</p>
                  </div>

                  <div className="space-y-2">
                    {sentPendingInvites.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                        No invites are currently waiting on a response.
                      </div>
                    ) : (
                      sentPendingInvites.map((invite) => (
                        <div key={invite.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">{invite.email}</p>
                              <Badge variant="outline" className="border-amber-300 text-amber-800">
                                <Clock3 className="mr-1 h-3 w-3" />
                                Pending
                              </Badge>
                              <Badge variant="outline" className="capitalize">{invite.circle}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">Sent {formatShortDate(invite.created_at)}</p>
                          </div>
                          {isOwner ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={saving}
                              onClick={() => runAction({ action: "cancel_invite", invite_id: invite.id })}
                            >
                              Cancel
                            </Button>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>

                  {acceptedInvites.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accepted</p>
                      {acceptedInvites.slice(0, 5).map((invite) => (
                        <div key={invite.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <p className="text-sm font-medium">{invite.email}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Accepted {formatShortDate(invite.accepted_at || invite.created_at)}
                            </p>
                          </div>
                          <Badge variant="outline" className="border-emerald-300 text-emerald-800">Accepted</Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {declinedInvites.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Declined</p>
                      {declinedInvites.slice(0, 5).map((invite) => (
                        <div key={invite.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <p className="text-sm font-medium">{invite.email}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Declined after invite sent {formatShortDate(invite.created_at)}
                            </p>
                          </div>
                          <Badge variant="outline">Declined</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Baby className="h-4 w-4" />
                  Kids Nap Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Kid name" value={kidName} onChange={(e) => setKidName(e.target.value)} />
                  <Input type="date" value={napDate} onChange={(e) => setNapDate(e.target.value)} />
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
                <Textarea
                  rows={2}
                  placeholder="Notes"
                  value={napNotes}
                  onChange={(e) => setNapNotes(e.target.value)}
                />
                <Button
                  disabled={saving || !kidName.trim()}
                  onClick={async () => {
                    const ok = await runAction({
                      action: "add_nap",
                      kid_name: kidName.trim(),
                      nap_date: napDate,
                      start_time: startTime || null,
                      end_time: endTime || null,
                      notes: napNotes.trim() || null,
                    });
                    if (ok) {
                      setKidName("");
                      setStartTime("");
                      setEndTime("");
                      setNapNotes("");
                    }
                  }}
                >
                  Save Nap
                </Button>

                <div className="rounded-lg border divide-y">
                  {data.naps.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-3 py-4">No naps logged yet.</p>
                  ) : data.naps.map((nap) => (
                    <div key={nap.id} className="px-3 py-2 flex items-center justify-between gap-2">
                      <div className="text-sm">
                        <p className="font-medium">{nap.kid_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {nap.nap_date} {nap.start_time ? `\u00b7 ${nap.start_time}` : ""}{nap.end_time ? ` - ${nap.end_time}` : ""}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => runAction({ action: "delete_nap", id: nap.id })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <HeartHandshake className="h-4 w-4" />
                  Partner Cycle and Support
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.cycle && (
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          {(data.cycle.partner_name || partnerName || "Partner") + "'s current cycle"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Week {cycleWeek ?? "-"} - {cycleWeekLabel(cycleWeek)}
                        </p>
                      </div>
                      {cycleWeek && (
                        <Badge variant="secondary" className="shrink-0">
                          Week {cycleWeek}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border bg-background px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Cycle Start</p>
                        <p className="font-medium mt-1">{formatCycleDate(data.cycle.cycle_start_date)}</p>
                      </div>
                      <div className="rounded-lg border bg-background px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Cadence</p>
                        <p className="font-medium mt-1">
                          {data.cycle.cycle_length_days} day cycle / {data.cycle.period_length_days} day period
                        </p>
                      </div>
                    </div>

                    {data.cycle.notes ? (
                      <div className="rounded-lg border bg-background px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                        <p className="text-sm mt-1 text-muted-foreground">{data.cycle.notes}</p>
                      </div>
                    ) : null}

                    <div className="rounded-lg border bg-background px-3 py-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">Current partner tips</p>
                        <Button variant="outline" size="sm" disabled={!cycleWeek || tipsLoading} onClick={generateCycleTips}>
                          {tipsLoading ? "Refreshing..." : "Refresh Tips"}
                        </Button>
                      </div>

                      {tips ? (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">{tips.summary}</p>
                          <div>
                            <p className="text-xs font-semibold uppercase text-muted-foreground">This week</p>
                            <ul className="mt-1 space-y-1 text-sm">
                              {tips.tips.slice(0, 4).map((tip) => (
                                <li key={tip}>- {tip}</li>
                              ))}
                            </ul>
                          </div>
                          {tips.avoid.length > 0 ? (
                            <div>
                              <p className="text-xs font-semibold uppercase text-muted-foreground">Avoid</p>
                              <ul className="mt-1 space-y-1 text-sm">
                                {tips.avoid.slice(0, 3).map((tip) => (
                                  <li key={tip}>- {tip}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Generate tips to see weekly support ideas here.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Partner name" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} />
                  <Input type="date" value={cycleStart} onChange={(e) => setCycleStart(e.target.value)} />
                  <div>
                    <Label className="text-xs">Cycle length (days)</Label>
                    <Input type="number" min={21} max={40} value={cycleLength} onChange={(e) => setCycleLength(Number(e.target.value) || 28)} />
                  </div>
                  <div>
                    <Label className="text-xs">Period length (days)</Label>
                    <Input type="number" min={2} max={10} value={periodLength} onChange={(e) => setPeriodLength(Number(e.target.value) || 5)} />
                  </div>
                </div>
                <Textarea rows={2} placeholder="Notes" value={cycleNotes} onChange={(e) => setCycleNotes(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={saving || !cycleStart}
                    onClick={() => runAction({
                      action: "save_cycle",
                      partner_name: partnerName || null,
                      cycle_start_date: cycleStart,
                      cycle_length_days: cycleLength,
                      period_length_days: periodLength,
                      notes: cycleNotes || null,
                    })}
                  >
                    Save Cycle
                  </Button>
                  <Button variant="outline" disabled={!cycleWeek || tipsLoading} onClick={generateCycleTips}>
                    {tipsLoading ? "Generating..." : "Get GPT Partner Tips"}
                  </Button>
                </div>
                {cycleWeek && (
                  <p className="text-sm text-muted-foreground">
                    Current cycle week: <span className="font-medium text-foreground">Week {cycleWeek}</span>
                  </p>
                )}

                {tips && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-sm font-semibold">{tips.summary}</p>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Support ideas</p>
                      <ul className="text-sm mt-1 space-y-1">
                        {tips.tips.map((tip) => <li key={tip}>- {tip}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Avoid</p>
                      <ul className="text-sm mt-1 space-y-1">
                        {tips.avoid.map((tip) => <li key={tip}>- {tip}</li>)}
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
