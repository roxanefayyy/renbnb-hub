import { NextResponse } from "next/server";
import { syncHospitable } from "@/lib/bookings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called daily by Vercel Cron (see vercel.json). Vercel sends: Authorization: Bearer $CRON_SECRET
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await syncHospitable()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
