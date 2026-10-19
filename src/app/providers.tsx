'use client';

import React from 'react';
import { QueryClient, QueryClientProvider, isServer } from '@tanstack/react-query';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchInterval: 7000, // 7 seconds live polling (5-10s requirement)
        refetchOnWindowFocus: true,
        staleTime: 5000,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
