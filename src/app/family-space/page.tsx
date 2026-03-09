"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Baby, HeartHandshake, Trash2, UserPlus } from "lucide-react";

type Circle = "family" | "extended";

interface FamilyMember {
  id: number;
  user_id: number;
  circle: Circle;
  role: string;
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
  members: FamilyMember[];
  invites: Invite[];
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
      let parsed: { error?: string } = {};
      try {
        parsed = raw ? (JSON.parse(raw) as { error?: string }) : {};
      } catch {
        parsed = {};
      }
      if (!res.ok) {
        setActionMessage(parsed.error ?? "Unable to save family update.");
        return false;
      }
      await load();
      return true;
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Unable to save family update.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function generateCycleTips() {
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
  }

  const familyMembers = useMemo(
    () => (data?.members ?? []).filter((m) => m.circle === "family"),
    [data]
  );
  const extendedMembers = useMemo(
    () => (data?.members ?? []).filter((m) => m.circle === "extended"),
    [data]
  );
  const cycleWeek = calcCycleWeek(data?.cycle ?? null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Family Space</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invite loved ones, organize family circles, and track home rhythms together.
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
                <UserPlus className="h-4 w-4" />
                Circles and Invites
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  Invite
                </Button>
              </div>
              {actionMessage ? <p className="text-sm text-muted-foreground">{actionMessage}</p> : null}

              <div className="grid md:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-semibold mb-2">Family Circle</p>
                  <div className="space-y-1.5">
                    {familyMembers.map((m) => (
                      <p key={m.id} className="text-sm">{`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email || `User ${m.user_id}`}</p>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-semibold mb-2">Extended Family</p>
                  <div className="space-y-1.5">
                    {extendedMembers.map((m) => (
                      <p key={m.id} className="text-sm">{`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email || `User ${m.user_id}`}</p>
                    ))}
                  </div>
                </div>
              </div>

              {data.invites.length > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-semibold mb-2">Recent Invites</p>
                  <div className="space-y-1 text-sm">
                    {data.invites.slice(0, 8).map((invite) => (
                      <p key={invite.id}>
                        {invite.email} · <span className="capitalize">{invite.circle}</span> ·{" "}
                        <Badge variant="outline" className="text-[10px]">{invite.status}</Badge>
                      </p>
                    ))}
                  </div>
                </div>
              )}
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
                          {nap.nap_date} {nap.start_time ? `· ${nap.start_time}` : ""}{nap.end_time ? ` - ${nap.end_time}` : ""}
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
