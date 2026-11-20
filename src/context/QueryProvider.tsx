"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let activeQueryClient: QueryClient | null = null;

export function clearAllQueryCaches(): void {
  if (activeQueryClient) {
    activeQueryClient.clear();
  }
}

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000, // 1 minute fresh cache
          gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
          refetchOnWindowFocus: false,
          retry: 1,
        },
      },
    });
    activeQueryClient = client;
    return client;
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
