import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import ForexClient from "./ForexClient";

export const metadata: Metadata = {
  title: "Forex Trading",
  description: "Manage your forex accounts, trades, and PnL.",
};

export const dynamic = "force-dynamic";

export default async function ForexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Suspense fallback={null}>
      <ForexClient />
    </Suspense>
  );
}
