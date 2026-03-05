import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isAdminEmail } from "@/lib/admin";
import sql from "@/lib/db";

interface AdminUserRow {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  profile_image_url: string | null;
  last_login_at: string | null;
  logins_today: number;
}

interface DailyRow {
  day: string;
  login_count: number;
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!isAdminEmail(session?.user?.email)) {
    redirect("/dashboard");
  }

  const users = (await sql`
    SELECT
      up.id,
      up.first_name,
      up.last_name,
      up.email,
      up.profile_image_url,
      MAX(le.logged_in_at)::text AS last_login_at,
      COUNT(*) FILTER (WHERE le.logged_in_at::date = CURRENT_DATE)::int AS logins_today
    FROM user_profiles up
    LEFT JOIN auth_login_events le ON le.user_id = up.id
    GROUP BY up.id, up.first_name, up.last_name, up.email, up.profile_image_url
    ORDER BY MAX(le.logged_in_at) DESC NULLS LAST, up.created_at DESC
  `) as AdminUserRow[];

  const daily = (await sql`
    SELECT
      logged_in_at::date::text AS day,
      COUNT(*)::int AS login_count
    FROM auth_login_events
    WHERE logged_in_at >= CURRENT_DATE - INTERVAL '14 days'
    GROUP BY logged_in_at::date
    ORDER BY day DESC
  `) as DailyRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">User activity and login metrics.</p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold mb-3">Daily Logins (Last 14 Days)</h2>
        <div className="space-y-2">
          {daily.length === 0 ? (
            <p className="text-sm text-muted-foreground">No login events yet.</p>
          ) : (
            daily.map((row) => (
              <div key={row.day} className="flex items-center justify-between text-sm">
                <span>{new Date(`${row.day}T12:00:00`).toLocaleDateString()}</span>
                <span className="font-medium">{row.login_count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold mb-3">Users</h2>
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 border rounded-lg p-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full overflow-hidden border bg-muted shrink-0">
                  {u.profile_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.profile_image_url} alt={u.email ?? "User"} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || "Unnamed User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{u.email ?? "No email"}</p>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground shrink-0">
                <p>Today: <span className="font-medium text-foreground">{u.logins_today ?? 0}</span></p>
                <p>
                  Last login:{" "}
                  <span className="font-medium text-foreground">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Never"}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
