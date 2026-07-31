import { NextResponse } from "next/server";
import { logoResolver } from "@/lib/logo-engine/resolver";
import { EntityCategory } from "@/lib/logo-engine/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const merchant = searchParams.get("merchant");
  const bank = searchParams.get("bank");
  const company = searchParams.get("company");
  const categoryParam = searchParams.get("category") as EntityCategory | null;
  const isJson = searchParams.get("json") === "true";
  const forceRefresh = searchParams.get("refresh") === "true";

  const query = merchant || bank || company || searchParams.get("q") || "";

  if (!query) {
    return NextResponse.json({ error: "Query parameter 'merchant', 'bank', or 'company' is required." }, { status: 400 });
  }

  let category: EntityCategory = "general";
  if (bank) category = "bank";
  else if (company) category = "company";
  else if (merchant) category = "merchant";
  else if (categoryParam) category = categoryParam;

  const record = await logoResolver.resolve(query, { category, forceRefresh });

  if (!record) {
    return NextResponse.json({ error: "Logo not found for entity", query }, { status: 404 });
  }

  // ETag Validation
  const clientEtag = request.headers.get("if-none-match");
  if (clientEtag && record.etag && clientEtag === record.etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        "Cache-Control": "public, max-age=2592000, stale-while-revalidate=86400",
        ETag: record.etag,
      },
    });
  }

  if (isJson) {
    return NextResponse.json(record, {
      headers: {
        "Cache-Control": "public, max-age=2592000, stale-while-revalidate=86400",
        ETag: record.etag || `W/"logo-${record.domain}"`,
      },
    });
  }

  // Redirect to optimized logo asset
  return NextResponse.redirect(record.best_logo_url, {
    status: 307,
    headers: {
      "Cache-Control": "public, max-age=2592000, stale-while-revalidate=86400",
      ETag: record.etag || `W/"logo-${record.domain}"`,
    },
  });
}
