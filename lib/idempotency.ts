import crypto from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function requestHash(body: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex");
}

export async function getReplayResponse(req: NextRequest, body: unknown) {
  const key = req.headers.get("Idempotency-Key");
  if (!key) return null;

  const record = await prisma.idempotencyRecord.findUnique({
    where: {
      key_method_path: {
        key,
        method: req.method,
        path: req.nextUrl.pathname
      }
    }
  });

  if (!record) return null;

  if (record.requestHash !== requestHash(body)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_IDEMPOTENCY_REPLAY",
          message: "This Idempotency-Key was already used with a different request body."
        }
      },
      { status: 409 }
    );
  }

  return NextResponse.json(record.response, { status: record.statusCode });
}

export async function saveIdempotentResponse(
  req: NextRequest,
  body: unknown,
  statusCode: number,
  response: unknown
) {
  const key = req.headers.get("Idempotency-Key");
  if (!key) return;

  try {
    await prisma.idempotencyRecord.create({
      data: {
        key,
        method: req.method,
        path: req.nextUrl.pathname,
        requestHash: requestHash(body),
        statusCode,
        response: response as Prisma.InputJsonValue
      }
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
      throw error;
    }
  }
}
