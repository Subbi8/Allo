import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";

export const dynamic = "force-dynamic";

async function handleCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (secret && req.headers.get("Authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid cron secret." } }, { status: 401 });
  }

  const result = await releaseExpiredReservations(prisma);
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
