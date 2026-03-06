"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UserProfile } from "@/types";
import { signOut } from "next-auth/react";

interface ProfileForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  dietary_restrictions: string;
  profile_image_url: string;
  calorie_goal: string;
  protein_goal_g: string;
  carbs_goal_g: string;
  fat_goal_g: string;
  fiber_goal_g: string;
  sodium_goal_mg: string;
  height_in: string;
  goal_weight_lbs: string;
}

export default function ProfilePage() {
  const [form, setForm] = useState<ProfileForm>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    dietary_restrictions: "",
    profile_image_url: "",
    calorie_goal: "2100",
    protein_goal_g: "180",
    carbs_goal_g: "170",
    fat_goal_g: "75",
    fiber_goal_g: "30",
    sodium_goal_mg: "2300",
    height_in: "",
    goal_weight_lbs: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  function parseJsonSafe<T>(raw: string, fallback: T): T {
    try {
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/profile");
        const raw = await res.text().catch(() => "");
        const profile = parseJsonSafe<UserProfile & { error?: string }>(
          raw,
          {} as UserProfile & { error?: string }
        );
        if (!res.ok) throw new Error(profile.error ?? "Failed to load profile");
        setForm({
          first_name: profile.first_name ?? "",
          last_name: profile.last_name ?? "",
          email: profile.email ?? "",
          phone: profile.phone ?? "",
          dietary_restrictions: (profile.dietary_restrictions ?? []).join(", "),
          profile_image_url: profile.profile_image_url ?? "",
          calorie_goal: profile.calorie_goal != null ? String(profile.calorie_goal) : "2100",
          protein_goal_g: profile.protein_goal_g != null ? String(profile.protein_goal_g) : "180",
          carbs_goal_g: profile.carbs_goal_g != null ? String(profile.carbs_goal_g) : "170",
          fat_goal_g: profile.fat_goal_g != null ? String(profile.fat_goal_g) : "75",
          fiber_goal_g: profile.fiber_goal_g != null ? String(profile.fiber_goal_g) : "30",
          sodium_goal_mg: profile.sodium_goal_mg != null ? String(profile.sodium_goal_mg) : "2300",
          height_in: profile.height_in != null ? String(profile.height_in) : "",
          goal_weight_lbs: profile.goal_weight_lbs != null ? String(profile.goal_weight_lbs) : "",
        });
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function setField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/profile/image", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Profile image upload failed");
      setForm((prev) => ({ ...prev, profile_image_url: data.profile_image_url ?? prev.profile_image_url }));
      setMessage("Profile image updated.");
    } catch (err) {
      setMessage(String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const restrictions = form.dietary_restrictions
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.first_name.trim() || null,
          last_name: form.last_name.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          dietary_restrictions: restrictions,
          profile_image_url: form.profile_image_url.trim() || null,
          calorie_goal: form.calorie_goal ? Number(form.calorie_goal) : null,
          protein_goal_g: form.protein_goal_g ? Number(form.protein_goal_g) : null,
          carbs_goal_g: form.carbs_goal_g ? Number(form.carbs_goal_g) : null,
          fat_goal_g: form.fat_goal_g ? Number(form.fat_goal_g) : null,
          fiber_goal_g: form.fiber_goal_g ? Number(form.fiber_goal_g) : null,
          sodium_goal_mg: form.sodium_goal_mg ? Number(form.sodium_goal_mg) : null,
          height_in: form.height_in ? Number(form.height_in) : null,
          goal_weight_lbs: form.goal_weight_lbs ? Number(form.goal_weight_lbs) : null,
          onboarding_completed: true,
        }),
      });
      const raw = await res.text().catch(() => "");
      const data = parseJsonSafe<{ error?: string }>(raw, {});
      if (!res.ok) throw new Error(data.error ?? "Failed to save profile");

      localStorage.setItem("firstName", form.first_name.trim());
      setMessage("Profile saved.");
    } catch (err) {
      setMessage(String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading profile...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your personal settings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 rounded-full overflow-hidden border bg-muted shrink-0">
                {form.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-photo">Profile Picture</Label>
                <Input id="profile-photo" type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
                <p className="text-xs text-muted-foreground">{uploading ? "Uploading..." : "PNG or JPG recommended."}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="first_name">First Name</Label>
                <Input id="first_name" value={form.first_name} onChange={(e) => setField("first_name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="last_name">Last Name</Label>
                <Input id="last_name" value={form.last_name} onChange={(e) => setField("last_name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dietary_restrictions">Dietary Restrictions</Label>
              <Textarea
                id="dietary_restrictions"
                placeholder="e.g. gluten-free, dairy-free, low-sodium"
                value={form.dietary_restrictions}
                onChange={(e) => setField("dietary_restrictions", e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Comma separated list.</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Daily Macro Goals</p>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="calorie_goal">Calories</Label>
                  <Input id="calorie_goal" type="number" min={1} value={form.calorie_goal} onChange={(e) => setField("calorie_goal", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="protein_goal_g">Protein (g)</Label>
                  <Input id="protein_goal_g" type="number" min={1} value={form.protein_goal_g} onChange={(e) => setField("protein_goal_g", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="carbs_goal_g">Carbs (g)</Label>
                  <Input id="carbs_goal_g" type="number" min={1} value={form.carbs_goal_g} onChange={(e) => setField("carbs_goal_g", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fat_goal_g">Fat (g)</Label>
                  <Input id="fat_goal_g" type="number" min={1} value={form.fat_goal_g} onChange={(e) => setField("fat_goal_g", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fiber_goal_g">Fiber (g)</Label>
                  <Input id="fiber_goal_g" type="number" min={1} value={form.fiber_goal_g} onChange={(e) => setField("fiber_goal_g", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sodium_goal_mg">Sodium (mg)</Label>
                  <Input id="sodium_goal_mg" type="number" min={1} value={form.sodium_goal_mg} onChange={(e) => setField("sodium_goal_mg", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Body Targets</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="height_in">Height (inches)</Label>
                  <Input id="height_in" type="number" min={1} value={form.height_in} onChange={(e) => setField("height_in", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="goal_weight_lbs">Goal Weight (lbs)</Label>
                  <Input id="goal_weight_lbs" type="number" min={1} value={form.goal_weight_lbs} onChange={(e) => setField("goal_weight_lbs", e.target.value)} />
                </div>
              </div>
            </div>

            {message && <p className="text-sm text-muted-foreground">{message}</p>}

            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => signOut({ callbackUrl: "/signin" })}
            >
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
