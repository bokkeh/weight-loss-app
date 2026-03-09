"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type SharePreferences = {
  share_profile: boolean;
  share_weight: boolean;
  share_food: boolean;
  share_water: boolean;
  share_recipes: boolean;
  share_chat: boolean;
  share_family: boolean;
};

const DEFAULT_PREFS: SharePreferences = {
  share_profile: true,
  share_weight: true,
  share_food: true,
  share_water: true,
  share_recipes: true,
  share_chat: true,
  share_family: true,
};

const TOGGLE_ROWS: Array<{ key: keyof SharePreferences; label: string; description: string }> = [
  { key: "share_profile", label: "Profile", description: "Name, email, and profile details." },
  { key: "share_weight", label: "Weight data", description: "Weight entries and trends." },
  { key: "share_food", label: "Food log data", description: "Meals, calories, and macros." },
  { key: "share_water", label: "Water data", description: "Hydration logs and summaries." },
  { key: "share_recipes", label: "Recipe data", description: "Saved recipes and recipe activity." },
  { key: "share_chat", label: "AI chat data", description: "Messages exchanged with AI tools." },
  { key: "share_family", label: "Family Space data", description: "Invites, naps, cycles, and family list activity." },
];

export default function MyDataPage() {
  const [prefs, setPrefs] = useState<SharePreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMessage("");
      try {
        const res = await fetch("/api/my-data");
        const raw = await res.text().catch(() => "");
        const parsed = raw ? (JSON.parse(raw) as { preferences?: SharePreferences; error?: string }) : {};
        if (!res.ok) throw new Error(parsed.error ?? "Failed to load data settings.");
        setPrefs({ ...DEFAULT_PREFS, ...(parsed.preferences ?? {}) });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load data settings.");
      } finally {
        setLoading(false);
      }
    }
    load().catch(() => undefined);
  }, []);

  async function savePreferences() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/my-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const raw = await res.text().catch(() => "");
      const parsed = raw ? (JSON.parse(raw) as { preferences?: SharePreferences; error?: string }) : {};
      if (!res.ok) throw new Error(parsed.error ?? "Failed to save preferences.");
      if (parsed.preferences) setPrefs(parsed.preferences);
      setMessage("Data sharing settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  }

  async function exportAllData() {
    setExporting(true);
    setMessage("");
    try {
      const res = await fetch("/api/my-data?export=1");
      const raw = await res.text().catch(() => "");
      const parsed = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!res.ok) throw new Error(parsed.error ?? "Failed to export data.");

      const filenameDate = new Date().toISOString().slice(0, 10);
      const blob = new Blob([raw], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `weighttrack-my-data-${filenameDate}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Data export downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to export data.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control what app admins can view and export all of your account data anytime.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Privacy Notice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            You own your data. Use this page to choose what categories can be visible to app admins and to download a full export.
          </p>
          <p>
            View full policy details at{" "}
            <Link className="underline underline-offset-2 text-foreground" href="/privacy-policy">
              Privacy Policy
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Share with App Admins</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {TOGGLE_ROWS.map((row) => (
            <label key={row.key} className="flex items-start justify-between gap-3 rounded-lg border p-3 cursor-pointer">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{row.label}</Label>
                <p className="text-xs text-muted-foreground">{row.description}</p>
              </div>
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={prefs[row.key]}
                disabled={loading || saving}
                onChange={(e) =>
                  setPrefs((prev) => ({
                    ...prev,
                    [row.key]: e.target.checked,
                  }))
                }
              />
            </label>
          ))}

          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button disabled={loading || saving} onClick={savePreferences}>
              {saving ? "Saving..." : "Save Data Preferences"}
            </Button>
            <Button variant="outline" disabled={loading || exporting} onClick={exportAllData}>
              {exporting ? "Exporting..." : "Export My Data"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
