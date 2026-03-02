import { neon } from "@neondatabase/serverless";

// Lazy client: created on first query, not at module load time.
let client: ReturnType<typeof neon> | null = null;

function getClient(): ReturnType<typeof neon> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL environment variable is not set");
    client = neon(url);
  }
  return client;
}

// Typed as a tagged template literal that always returns Promise<any[]>
// so destructuring like `const [row] = await sql\`...\`` works without casts.
type SqlTagFn = (
  strings: TemplateStringsArray,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...values: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => Promise<any[]>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sql: SqlTagFn = (strings: TemplateStringsArray, ...values: any[]) =>
  getClient()(strings, ...values) as Promise<any[]>;

export default sql;
