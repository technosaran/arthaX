import { Suspense } from "react";
import RetirementClient from "./RetirementClient";
import { ModuleGuard } from "@/components/module-guard";

export const metadata = {
  title: "Retirement & FIRE",
  description: "Forecast your path to financial independence and early retirement.",
};

export default async function RetirementPage() {
  return (
    <Suspense fallback={<div className="animate-pulse bg-white/5 h-screen rounded-2xl" />}>
      <ModuleGuard moduleKey="Retirement">
        <RetirementClient />
      </ModuleGuard>
    </Suspense>
  );
}
