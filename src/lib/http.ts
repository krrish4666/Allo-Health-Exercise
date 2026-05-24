import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/lib/errors";

export type ApiResponseBody<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; issues?: unknown } };

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiResponseBody<T>>({ ok: true, data }, init);
}

export function fail(error: unknown) {
  const response = errorResponse(error);
  return NextResponse.json(response.body, { status: response.status });
}

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          issues: error.flatten()
        }
      }
    } satisfies { status: number; body: ApiResponseBody<never> };
  }

  if (error instanceof HttpError) {
    return {
      status: error.status,
      body: { ok: false, error: { code: error.code, message: error.message } }
    } satisfies { status: number; body: ApiResponseBody<never> };
  }

  console.error(error);
  return {
    status: 500,
    body: { ok: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected server error." } }
  } satisfies { status: number; body: ApiResponseBody<never> };
}

export async function parseJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
