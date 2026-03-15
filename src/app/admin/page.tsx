import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
  share_profile: boolean;
  share_weight: boolean;
  share_food: boolean;
  share_water: boolean;
  share_recipes: boolean;
  share_chat: boolean;
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
  signin_page_views_14d: number;
  oauth_clicks_14d: number;
  feature_requests: number;
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

interface FeatureRequestRow {
  id: number;
  user_id: number;
  title: string;
  description: string;
  status: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

const ADMIN_TIME_ZONE = "America/Chicago";

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() <= 1970) return "Never";
  const now = new Date();
  const sameDay =
    parsed.toLocaleDateString("en-US", { timeZone: ADMIN_TIME_ZONE }) ===
    now.toLocaleDateString("en-US", { timeZone: ADMIN_TIME_ZONE });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    parsed.toLocaleDateString("en-US", { timeZone: ADMIN_TIME_ZONE }) ===
    yesterday.toLocaleDateString("en-US", { timeZone: ADMIN_TIME_ZONE });

  const timeLabel = parsed.toLocaleTimeString("en-US", {
    timeZone: ADMIN_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });

  if (sameDay) return `Today at ${timeLabel}`;
  if (isYesterday) return `Yesterday at ${timeLabel}`;

  return parsed.toLocaleString("en-US", {
    timeZone: ADMIN_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!isAdminEmail(session?.user?.email)) {
    redirect("/dashboard");
  }

  await sql`
    CREATE TABLE IF NOT EXISTS user_data_preferences (
      user_id        INTEGER PRIMARY KEY,
      share_profile  BOOLEAN NOT NULL DEFAULT TRUE,
      share_weight   BOOLEAN NOT NULL DEFAULT TRUE,
      share_food     BOOLEAN NOT NULL DEFAULT TRUE,
      share_water    BOOLEAN NOT NULL DEFAULT TRUE,
      share_recipes  BOOLEAN NOT NULL DEFAULT TRUE,
      share_chat     BOOLEAN NOT NULL DEFAULT TRUE,
      share_family   BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  async function closeFeatureRequest(formData: FormData) {
    "use server";
    const currentSession = await getServerSession(authOptions);
    if (!isAdminEmail(currentSession?.user?.email)) return;
    const id = Number(formData.get("id"));
    if (!Number.isFinite(id) || id <= 0) return;
    await sql`
      UPDATE feature_requests
      SET status = 'closed'
      WHERE id = ${id}
    `;
    revalidatePath("/admin");
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
        COUNT(*) FILTER (
          WHERE (logged_in_at AT TIME ZONE 'America/Chicago')::date =
                (NOW() AT TIME ZONE 'America/Chicago')::date
        )::int AS logins_today,
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
    ),
    pref_agg AS (
      SELECT
        user_id,
        share_profile,
        share_weight,
        share_food,
        share_water,
        share_recipes,
        share_chat
      FROM user_data_preferences
    )
    SELECT
      au.user_id::int AS id,
      CASE WHEN COALESCE(pf.share_profile, TRUE) THEN up.first_name ELSE NULL END AS first_name,
      CASE WHEN COALESCE(pf.share_profile, TRUE) THEN up.last_name ELSE NULL END AS last_name,
      CASE WHEN COALESCE(pf.share_profile, TRUE) THEN COALESCE(up.email, la.last_login_email) ELSE NULL END AS email,
      CASE WHEN COALESCE(pf.share_profile, TRUE) THEN up.profile_image_url ELSE NULL END AS profile_image_url,
      la.last_login_at::text,
      NULLIF(
        GREATEST(
          COALESCE(la.last_login_at, to_timestamp(0)),
          CASE WHEN COALESCE(pf.share_weight, TRUE) THEN COALESCE(wa.last_weight_at, to_timestamp(0)) ELSE to_timestamp(0) END,
          CASE WHEN COALESCE(pf.share_food, TRUE) THEN COALESCE(fa.last_food_at, to_timestamp(0)) ELSE to_timestamp(0) END,
          CASE WHEN COALESCE(pf.share_water, TRUE) THEN COALESCE(woa.last_water_at, to_timestamp(0)) ELSE to_timestamp(0) END,
          CASE WHEN COALESCE(pf.share_recipes, TRUE) THEN COALESCE(ra.last_recipe_at, to_timestamp(0)) ELSE to_timestamp(0) END,
          CASE WHEN COALESCE(pf.share_chat, TRUE) THEN COALESCE(ca.last_chat_at, to_timestamp(0)) ELSE to_timestamp(0) END
        ),
        to_timestamp(0)
      )::text AS last_activity_at,
      COALESCE(la.logins_today, 0)::int AS logins_today,
      COALESCE(pf.share_profile, TRUE) AS share_profile,
      COALESCE(pf.share_weight, TRUE) AS share_weight,
      COALESCE(pf.share_food, TRUE) AS share_food,
      COALESCE(pf.share_water, TRUE) AS share_water,
      COALESCE(pf.share_recipes, TRUE) AS share_recipes,
      COALESCE(pf.share_chat, TRUE) AS share_chat,
      CASE WHEN COALESCE(pf.share_weight, TRUE) THEN COALESCE(wa.weight_entries, 0)::int ELSE 0 END AS weight_entries,
      CASE WHEN COALESCE(pf.share_food, TRUE) THEN COALESCE(fa.food_logs, 0)::int ELSE 0 END AS food_logs,
      CASE WHEN COALESCE(pf.share_water, TRUE) THEN COALESCE(woa.water_logs, 0)::int ELSE 0 END AS water_logs,
      CASE WHEN COALESCE(pf.share_recipes, TRUE) THEN COALESCE(ra.recipes, 0)::int ELSE 0 END AS recipes,
      CASE WHEN COALESCE(pf.share_chat, TRUE) THEN COALESCE(ca.chat_messages, 0)::int ELSE 0 END AS chat_messages
    FROM all_user_ids au
    LEFT JOIN user_profiles up ON up.id = au.user_id
    LEFT JOIN login_agg la ON la.user_id = au.user_id
    LEFT JOIN weight_agg wa ON wa.user_id = au.user_id
    LEFT JOIN food_agg fa ON fa.user_id = au.user_id
    LEFT JOIN water_agg woa ON woa.user_id = au.user_id
    LEFT JOIN recipe_agg ra ON ra.user_id = au.user_id
    LEFT JOIN chat_agg ca ON ca.user_id = au.user_id
    LEFT JOIN pref_agg pf ON pf.user_id = au.user_id
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
      ((logged_in_at AT TIME ZONE 'America/Chicago')::date)::text AS day,
      COUNT(*)::int AS login_count
    FROM auth_login_events
    WHERE (logged_in_at AT TIME ZONE 'America/Chicago')::date >=
          ((NOW() AT TIME ZONE 'America/Chicago')::date - 13)
    GROUP BY (logged_in_at AT TIME ZONE 'America/Chicago')::date
    ORDER BY day DESC
  `) as DailyRow[];

  await sql`
    CREATE TABLE IF NOT EXISTS feature_requests (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL,
      title         TEXT NOT NULL,
      description   TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'open',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

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
      (
        SELECT COUNT(*)::int
        FROM auth_signin_events
        WHERE event_type = 'page_view'
          AND (created_at AT TIME ZONE 'America/Chicago')::date >=
              ((NOW() AT TIME ZONE 'America/Chicago')::date - 13)
      ) AS signin_page_views_14d,
      (
        SELECT COUNT(*)::int
        FROM auth_signin_events
        WHERE event_type = 'oauth_click'
          AND (created_at AT TIME ZONE 'America/Chicago')::date >=
              ((NOW() AT TIME ZONE 'America/Chicago')::date - 13)
      ) AS oauth_clicks_14d,
      (SELECT COUNT(*)::int FROM feature_requests) AS feature_requests,
      (SELECT COUNT(*) FROM weight_entries)::int AS weight_entries,
      (SELECT COUNT(*) FROM food_log_entries)::int AS food_logs,
      (SELECT COUNT(*) FROM water_log_entries)::int AS water_logs,
      (SELECT COUNT(*) FROM recipes)::int AS recipes,
      (SELECT COUNT(*) FROM chat_messages)::int AS chat_messages
  `) as GlobalTotals[];

  const featureRequests = (await sql`
    SELECT
      fr.id,
      fr.user_id,
      fr.title,
      fr.description,
      fr.status,
      fr.created_at::text,
      up.first_name,
      up.last_name,
      up.email
    FROM feature_requests fr
    LEFT JOIN user_profiles up ON up.id = fr.user_id
    ORDER BY fr.created_at DESC
    LIMIT 200
  `) as FeatureRequestRow[];
  const openFeatureRequests = featureRequests.filter((fr) => fr.status !== "closed");
  const closedFeatureRequests = featureRequests.filter((fr) => fr.status === "closed");

  const signinTraffic = (await sql`
    SELECT
      ((created_at AT TIME ZONE 'America/Chicago')::date)::text AS day,
      COUNT(*) FILTER (WHERE event_type = 'page_view')::int AS page_views,
      COUNT(*) FILTER (WHERE event_type = 'oauth_click')::int AS oauth_clicks
    FROM auth_signin_events
    WHERE (created_at AT TIME ZONE 'America/Chicago')::date >=
          ((NOW() AT TIME ZONE 'America/Chicago')::date - 13)
    GROUP BY (created_at AT TIME ZONE 'America/Chicago')::date
    ORDER BY day DESC
  `) as Array<{ day: string; page_views: number; oauth_clicks: number }>;

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
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Sign-In Page Views (14d)</p><p className="font-semibold">{totals?.signin_page_views_14d ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">OAuth Clicks (14d)</p><p className="font-semibold">{totals?.oauth_clicks_14d ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Feature Requests</p><p className="font-semibold">{totals?.feature_requests ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Weight Logs</p><p className="font-semibold">{totals?.weight_entries ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Food Logs</p><p className="font-semibold">{totals?.food_logs ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Water Logs</p><p className="font-semibold">{totals?.water_logs ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Recipes</p><p className="font-semibold">{totals?.recipes ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Chat Messages</p><p className="font-semibold">{totals?.chat_messages ?? 0}</p></div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold mb-3">Sign-In Traffic (Last 14 Days)</h2>
        <div className="space-y-2">
          {signinTraffic.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sign-in traffic events yet.</p>
          ) : (
            signinTraffic.map((row) => (
              <div key={row.day} className="flex items-center justify-between text-sm">
                <span>{new Date(`${row.day}T12:00:00`).toLocaleDateString()}</span>
                <span className="font-medium">
                  Views {row.page_views} | OAuth clicks {row.oauth_clicks}
                </span>
              </div>
            ))
          )}
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
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || "Private User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{u.email ?? "Profile hidden"}</p>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground shrink-0">
                <p>Today: <span className="font-medium text-foreground">{u.logins_today ?? 0}</span></p>
                <p>
                  Last login:{" "}
                  <span className="font-medium text-foreground">
                    {formatDateTime(u.last_login_at)}
                  </span>
                </p>
                <p>
                  Last activity:{" "}
                  <span className="font-medium text-foreground">
                    {formatDateTime(u.last_activity_at)}
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
      </div>      <div className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold mb-3">Feature Requests</h2>
        <div className="space-y-2">
          {featureRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feature requests yet.</p>
          ) : (
            <div className="space-y-3">
              {openFeatureRequests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Open</p>
                  {openFeatureRequests.map((fr) => (
                    <div key={fr.id} className="border rounded-lg p-3 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium">{fr.title}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground">{fr.status}</span>
                          <form action={closeFeatureRequest}>
                            <input type="hidden" name="id" value={fr.id} />
                            <button type="submit" className="text-xs rounded-md border px-2 py-0.5 hover:bg-muted">
                              Close
                            </button>
                          </form>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{fr.description}</p>
                      <p className="text-xs text-muted-foreground">
                        By {[fr.first_name, fr.last_name].filter(Boolean).join(" ") || "Unknown User"}
                        {fr.email ? ` (${fr.email})` : ""}
                        {` | ${formatDateTime(fr.created_at)}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Closed ({closedFeatureRequests.length})
                </summary>
                <div className="mt-3 space-y-2">
                  {closedFeatureRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No closed requests yet.</p>
                  ) : (
                    closedFeatureRequests.map((fr) => (
                      <div key={fr.id} className="border rounded-lg p-3 space-y-1 bg-muted/30">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-medium">{fr.title}</p>
                          <span className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground">{fr.status}</span>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{fr.description}</p>
                        <p className="text-xs text-muted-foreground">
                          By {[fr.first_name, fr.last_name].filter(Boolean).join(" ") || "Unknown User"}
                          {fr.email ? ` (${fr.email})` : ""}
                          {` | ${formatDateTime(fr.created_at)}`}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </details>
            </div>
          )}
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
                    First seen: {formatDateTime(row.first_seen_at)}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <p>Last login: <span className="font-medium text-foreground">{formatDateTime(row.last_seen_at)}</span></p>
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
