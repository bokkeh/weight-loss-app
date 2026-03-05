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
  last_activity_at: string | null;
  logins_today: number;
  weight_entries: number;
  food_logs: number;
  water_logs: number;
  recipes: number;
  chat_messages: number;
}

interface DailyRow {
  day: string;
  login_count: number;
}

interface GlobalTotals {
  users: number;
  profiles: number;
  historical_accounts: number;
  weight_entries: number;
  food_logs: number;
  water_logs: number;
  recipes: number;
  chat_messages: number;
}

interface HistoricalAccountRow {
  email: string;
  first_seen_at: string;
  last_seen_at: string;
  login_count: number;
  providers: string[];
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!isAdminEmail(session?.user?.email)) {
    redirect("/dashboard");
  }

  const users = (await sql`
    WITH all_user_ids AS (
      SELECT id AS user_id FROM user_profiles
      UNION
      SELECT user_id FROM auth_accounts
      UNION
      SELECT user_id FROM weight_entries
      UNION
      SELECT user_id FROM food_log_entries
      UNION
      SELECT user_id FROM water_log_entries
      UNION
      SELECT user_id FROM recipes
      UNION
      SELECT user_id FROM chat_messages
      UNION
      SELECT user_id FROM auth_login_events
    ),
    login_agg AS (
      SELECT
        user_id,
        MAX(logged_in_at) AS last_login_at,
        COUNT(*) FILTER (WHERE logged_in_at::date = CURRENT_DATE)::int AS logins_today,
        MAX(email) FILTER (WHERE email IS NOT NULL AND TRIM(email) <> '') AS last_login_email
      FROM auth_login_events
      GROUP BY user_id
    ),
    weight_agg AS (
      SELECT user_id, COUNT(*)::int AS weight_entries, MAX(created_at) AS last_weight_at
      FROM weight_entries
      GROUP BY user_id
    ),
    food_agg AS (
      SELECT user_id, COUNT(*)::int AS food_logs, MAX(created_at) AS last_food_at
      FROM food_log_entries
      GROUP BY user_id
    ),
    water_agg AS (
      SELECT user_id, COUNT(*)::int AS water_logs, MAX(created_at) AS last_water_at
      FROM water_log_entries
      GROUP BY user_id
    ),
    recipe_agg AS (
      SELECT user_id, COUNT(*)::int AS recipes, MAX(created_at) AS last_recipe_at
      FROM recipes
      GROUP BY user_id
    ),
    chat_agg AS (
      SELECT user_id, COUNT(*)::int AS chat_messages, MAX(created_at) AS last_chat_at
      FROM chat_messages
      GROUP BY user_id
    )
    SELECT
      au.user_id::int AS id,
      up.first_name,
      up.last_name,
      COALESCE(up.email, la.last_login_email) AS email,
      up.profile_image_url,
      la.last_login_at::text,
      GREATEST(
        COALESCE(la.last_login_at, to_timestamp(0)),
        COALESCE(wa.last_weight_at, to_timestamp(0)),
        COALESCE(fa.last_food_at, to_timestamp(0)),
        COALESCE(woa.last_water_at, to_timestamp(0)),
        COALESCE(ra.last_recipe_at, to_timestamp(0)),
        COALESCE(ca.last_chat_at, to_timestamp(0))
      )::text AS last_activity_at,
      COALESCE(la.logins_today, 0)::int AS logins_today,
      COALESCE(wa.weight_entries, 0)::int AS weight_entries,
      COALESCE(fa.food_logs, 0)::int AS food_logs,
      COALESCE(woa.water_logs, 0)::int AS water_logs,
      COALESCE(ra.recipes, 0)::int AS recipes,
      COALESCE(ca.chat_messages, 0)::int AS chat_messages
    FROM all_user_ids au
    LEFT JOIN user_profiles up ON up.id = au.user_id
    LEFT JOIN login_agg la ON la.user_id = au.user_id
    LEFT JOIN weight_agg wa ON wa.user_id = au.user_id
    LEFT JOIN food_agg fa ON fa.user_id = au.user_id
    LEFT JOIN water_agg woa ON woa.user_id = au.user_id
    LEFT JOIN recipe_agg ra ON ra.user_id = au.user_id
    LEFT JOIN chat_agg ca ON ca.user_id = au.user_id
    ORDER BY
      GREATEST(
        COALESCE(la.last_login_at, to_timestamp(0)),
        COALESCE(wa.last_weight_at, to_timestamp(0)),
        COALESCE(fa.last_food_at, to_timestamp(0)),
        COALESCE(woa.last_water_at, to_timestamp(0)),
        COALESCE(ra.last_recipe_at, to_timestamp(0)),
        COALESCE(ca.last_chat_at, to_timestamp(0))
      ) DESC,
      au.user_id DESC
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

  const [totals] = (await sql`
    WITH all_user_ids AS (
      SELECT id AS user_id FROM user_profiles
      UNION
      SELECT user_id FROM auth_accounts
      UNION
      SELECT user_id FROM weight_entries
      UNION
      SELECT user_id FROM food_log_entries
      UNION
      SELECT user_id FROM water_log_entries
      UNION
      SELECT user_id FROM recipes
      UNION
      SELECT user_id FROM chat_messages
      UNION
      SELECT user_id FROM auth_login_events
    )
    SELECT
      (SELECT COUNT(*) FROM all_user_ids)::int AS users,
      (SELECT COUNT(*) FROM user_profiles)::int AS profiles,
      (
        SELECT COUNT(DISTINCT LOWER(email))::int
        FROM auth_login_events
        WHERE email IS NOT NULL AND TRIM(email) <> ''
      ) AS historical_accounts,
      (SELECT COUNT(*) FROM weight_entries)::int AS weight_entries,
      (SELECT COUNT(*) FROM food_log_entries)::int AS food_logs,
      (SELECT COUNT(*) FROM water_log_entries)::int AS water_logs,
      (SELECT COUNT(*) FROM recipes)::int AS recipes,
      (SELECT COUNT(*) FROM chat_messages)::int AS chat_messages
  `) as GlobalTotals[];

  const historicalAccounts = (await sql`
    SELECT
      LOWER(email) AS email,
      MIN(logged_in_at)::text AS first_seen_at,
      MAX(logged_in_at)::text AS last_seen_at,
      COUNT(*)::int AS login_count,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT provider), NULL)::text[] AS providers
    FROM auth_login_events
    WHERE email IS NOT NULL AND TRIM(email) <> ''
    GROUP BY LOWER(email)
    ORDER BY MAX(logged_in_at) DESC
  `) as HistoricalAccountRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">All users and full database activity across the app.</p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold mb-3">Global Totals</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Users</p><p className="font-semibold">{totals?.users ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Profiles</p><p className="font-semibold">{totals?.profiles ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Historical Accounts</p><p className="font-semibold">{totals?.historical_accounts ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Weight Logs</p><p className="font-semibold">{totals?.weight_entries ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Food Logs</p><p className="font-semibold">{totals?.food_logs ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Water Logs</p><p className="font-semibold">{totals?.water_logs ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Recipes</p><p className="font-semibold">{totals?.recipes ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Chat Messages</p><p className="font-semibold">{totals?.chat_messages ?? 0}</p></div>
        </div>
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
                <p>
                  Last activity:{" "}
                  <span className="font-medium text-foreground">
                    {u.last_activity_at ? new Date(u.last_activity_at).toLocaleString() : "Never"}
                  </span>
                </p>
                <p className="mt-1">
                  Data:{" "}
                  <span className="font-medium text-foreground">
                    W {u.weight_entries} | F {u.food_logs} | H2O {u.water_logs} | R {u.recipes} | C {u.chat_messages}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold mb-3">Historical Accounts (All-Time)</h2>
        <div className="space-y-2">
          {historicalAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No historical login accounts found yet.</p>
          ) : (
            historicalAccounts.map((row) => (
              <div key={row.email} className="flex items-center justify-between text-sm border rounded-lg p-3 gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{row.email}</p>
                  <p className="text-xs text-muted-foreground">
                    First seen: {new Date(row.first_seen_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <p>Last login: <span className="font-medium text-foreground">{new Date(row.last_seen_at).toLocaleString()}</span></p>
                  <p>Logins: <span className="font-medium text-foreground">{row.login_count}</span></p>
                  <p>Providers: <span className="font-medium text-foreground">{row.providers.length > 0 ? row.providers.join(", ") : "unknown"}</span></p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
