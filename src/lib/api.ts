import { NextResponse } from "next/server";
import { z } from "zod";

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export async function parseJsonBody<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  const body = await req.json().catch(() => ({}));
  return schema.parse(body);
}

export function handleApiError(error: unknown, fallbackMessage = "Internal server error") {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return badRequest(issue?.message ?? "Invalid request data");
  }

  console.error(fallbackMessage, error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
