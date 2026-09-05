// app/dev/smoke-test/page.tsx
//
// Throwaway page — delete once Phase 1 is confirmed working.
// Exercises the full chain: session cookie -> apiClient -> envelope parsing
// -> ApiError on failure, against a real endpoint (Licenses, Admin/Superadmin-only,
// so a 403 here also confirms RBAC and the role plumbing are wired correctly).

"use client"

import { useEffect, useState } from "react"
import { apiClient, ApiError } from "@/lib/api/client"
import { useSession } from "@/lib/auth/client"
import type { License } from "@/types/api"
import type { Pagination } from "@/lib/api/client"

export default function SmokeTestPage() {
    const { data: session, isPending: sessionLoading } = useSession()
    const [result, setResult] = useState<{ data: License[]; pagination?: Pagination } | null>(null)
    const [error, setError] = useState<ApiError | Error | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (sessionLoading || !session) return
        setLoading(true)
        apiClient
            .get<License[]>("/api/licenses")
            .then(setResult)
            .catch(setError)
            .finally(() => setLoading(false))
    }, [session, sessionLoading])

    return (
        <div style={{ padding: 24, fontFamily: "monospace" }}>
            <h2>Phase 1 smoke test — GET /api/licenses</h2>

            <section style={{ marginTop: 16 }}>
                <strong>Session:</strong>
                <pre>{sessionLoading ? "loading..." : JSON.stringify(session, null, 2)}</pre>
            </section>

            <section style={{ marginTop: 16 }}>
                <strong>Request state:</strong>
                {loading && <p>fetching...</p>}

                {error && (
                    <div style={{ color: "crimson" }}>
                        <p>ERROR</p>
                        <pre>
                            {error instanceof ApiError
                                ? JSON.stringify({ status: error.status, code: error.code, message: error.message, details: error.details }, null, 2)
                                : error.message}
                        </pre>
                    </div>
                )}

                {result && (
                    <div style={{ color: "green" }}>
                        <p>SUCCESS</p>
                        <pre>{JSON.stringify(result, null, 2)}</pre>
                    </div>
                )}
            </section>
        </div>
    )
}