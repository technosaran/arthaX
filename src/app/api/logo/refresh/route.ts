import { NextResponse } from "next/server";
import { logoResolver } from "@/lib/logo-engine/resolver";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { merchant, domain, category } = body || {};

    const query = merchant || domain;
    if (!query) {
      return NextResponse.json({ error: "Field 'merchant' or 'domain' is required in request body" }, { status: 400 });
    }

    const updatedRecord = await logoResolver.resolve(query, { forceRefresh: true, category });

    if (!updatedRecord) {
      return NextResponse.json({ error: "Failed to refresh logo from provider pipeline" }, { status: 502 });
    }

    return NextResponse.json({
      message: "Logo successfully refreshed",
      record: updatedRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
