import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mt-1">
          How WeightTrack collects, uses, and protects your data.
        </p>
      </div>

      <section className="space-y-2 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Data We Store</h2>
        <p>
          Account details, profile settings, weight logs, food logs, water logs, recipes, grocery data, family space entries, and AI chat history.
        </p>
      </section>

      <section className="space-y-2 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">How Data Is Used</h2>
        <p>
          Data is used to power tracking features, generate insights, and improve app functionality. You can control admin visibility from the{" "}
          <Link href="/my-data" className="underline underline-offset-2 text-foreground">
            My Data
          </Link>{" "}
          page.
        </p>
      </section>

      <section className="space-y-2 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Your Controls</h2>
        <p>
          You can export your full account data and manage what categories are shared with app admins at any time.
        </p>
      </section>

      <section className="space-y-2 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Contact</h2>
        <p>
          For privacy questions, use the in-app feature request form and include "Privacy" in your request title.
        </p>
      </section>
    </div>
  );
}
