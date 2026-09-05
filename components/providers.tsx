// components/providers.tsx

"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

export function Providers({ children }: { children: React.ReactNode }) {
    // useState (not a module-level singleton) so each request gets its own
    // client on the server, while the client still reuses one instance across
    // re-renders in the browser — the standard Next.js App Router pattern.
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // Materials/equipment/approvals data is invalidate-on-write
                        // driven (see approval-invalidation.ts) rather than time-based,
                        // so a short default staleTime avoids refetch storms without
                        // masking real changes. Long-lived resources (Licenses,
                        // Warehouses, Tenders, Categories) override this per-query
                        // in their own hooks.
                        staleTime: 30 * 1000,
                        retry: 1,
                    },
                },
            })
    )

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}