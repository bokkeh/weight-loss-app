"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  const { status } = useSession();
  const router = useRouter();
  const trackedPageView = useRef(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  useEffect(() => {
    if (trackedPageView.current) return;
    trackedPageView.current = true;
    fetch("/api/auth/signin-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "page_view",
        path: "/signin",
      }),
    }).catch(() => undefined);
  }, []);

  async function handleGoogleSignIn() {
    await fetch("/api/auth/signin-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "oauth_click",
        provider: "google",
        path: "/signin",
      }),
    }).catch(() => undefined);

    await signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <h1 className="text-xl font-semibold">Sign in to WeightTrack</h1>
        <p className="text-sm text-muted-foreground">
          Use your account to keep your own private logs and progress.
        </p>
        <Button
          className="w-full"
          onClick={handleGoogleSignIn}
        >
          Continue with Google
        </Button>
      </div>
    </div>
  );
}
