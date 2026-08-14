import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import CryptoClient from "./CryptoClient";

export const metadata: Metadata = {
  title: "Crypto Assets",
  description: "Track your cryptocurrency portfolio, prices, and PnL.",
};

export const dynamic = "force-dynamic";

export default async function CryptoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Suspense fallback={null}>
      <CryptoClient />
    </Suspense>
  );
}
