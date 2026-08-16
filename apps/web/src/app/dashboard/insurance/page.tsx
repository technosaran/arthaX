import { Suspense } from "react";
import InsuranceClient from "./InsuranceClient";
import { ModuleGuard } from "@/components/module-guard";

export const metadata = {
  title: "Insurance Tracker",
  description: "Track your life, health, auto, and property insurance policies.",
};

export default async function InsurancePage() {
  return (
    <Suspense fallback={<div className="animate-pulse bg-white/5 h-screen rounded-2xl" />}>
      <ModuleGuard moduleKey="Insurance">
        <InsuranceClient />
      </ModuleGuard>
    </Suspense>
  );
}
