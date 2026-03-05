const DEFAULT_ADMIN_EMAILS = ["alexterry12@gmail.com"];

function normalize(email: string) {
  return email.trim().toLowerCase();
}

function envAdminEmails() {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalize);
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const allowed = new Set([...DEFAULT_ADMIN_EMAILS.map(normalize), ...envAdminEmails()]);
  return allowed.has(normalize(email));
}
