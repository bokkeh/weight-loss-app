"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UserProfile } from "@/types";

interface ProfileForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  dietary_restrictions: string;
  profile_image_url: string;
}

export default function ProfilePage() {
  const [form, setForm] = useState<ProfileForm>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    dietary_restrictions: "",
    profile_image_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/profile");
        const profile = (await res.json()) as UserProfile;
        setForm({
          first_name: profile.first_name ?? "",
          last_name: profile.last_name ?? "",
          email: profile.email ?? "",
          phone: profile.phone ?? "",
          dietary_restrictions: (profile.dietary_restrictions ?? []).join(", "),
          profile_image_url: profile.profile_image_url ?? "",
        });
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
        }),
      });
      const data = await res.json().catch(() => ({}));
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

            {message && <p className="text-sm text-muted-foreground">{message}</p>}

            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

