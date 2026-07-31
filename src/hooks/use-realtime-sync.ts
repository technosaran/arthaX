"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { createClient } from "@/lib/supabase-browser";
import { toast } from "react-hot-toast";

type RealtimeTables = "accounts" | "expenses" | "income" | "investments" | "transactions" | "liabilities";

const DEFAULT_TABLES: RealtimeTables[] = ["accounts", "expenses", "income", "investments", "transactions", "liabilities"];

/**
 * Hook to subscribe to Supabase Realtime Postgres changes across financial tables.
 * Triggers SWR revalidation automatically on INSERT/UPDATE/DELETE.
 */
export function useRealtimeSync(tables: RealtimeTables[] = DEFAULT_TABLES, enabled: boolean = true) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let supabase: ReturnType<typeof createClient> | null = null;
    try {
      supabase = createClient();
    } catch (_e) {
      // Ignore client creation error if env vars missing in preview
      return;
    }

    if (!supabase) return;

    const channelName = `realtime-financial-feed-${Date.now()}`;
    const channel = supabase.channel(channelName);

    tables.forEach((table) => {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        (payload: any) => {
          // Revalidate SWR caches for table endpoints
          mutate((key: any) => typeof key === "string" && (key.includes(table) || key.includes("dashboard") || key.includes("stats")));

          // Show subtle toast notification for external background updates
          if (payload.eventType === "INSERT") {
            toast.success(`Live sync: New record added to ${table}`, { id: `realtime-${table}` });
          } else if (payload.eventType === "UPDATE") {
            toast.success(`Live sync: ${table} updated`, { id: `realtime-${table}` });
          }
        }
      );
    });

    channel.subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [tables, enabled, mutate]);
}
