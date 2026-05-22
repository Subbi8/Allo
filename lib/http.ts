import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "NOT_ENOUGH_STOCK"
  | "RESERVATION_EXPIRED"
  | "INVALID_IDEMPOTENCY_REPLAY";

export function jsonError(status: number, code: ApiErrorCode, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function validationError(error: ZodError) {
  return jsonError(400, "BAD_REQUEST", "The request body is invalid.", error.flatten());
}
