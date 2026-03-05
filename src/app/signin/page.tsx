import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { Button } from "@/components/ui/button";

export default async function SignInPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <h1 className="text-xl font-semibold">Sign in to WeightTrack</h1>
        <p className="text-sm text-muted-foreground">
          Use your account to keep your own private logs and progress.
        </p>
        <Button asChild className="w-full">
          <Link href="/api/auth/signin/google?callbackUrl=/dashboard">
            Continue with Google
          </Link>
        </Button>
      </div>
    </div>
  );
}
