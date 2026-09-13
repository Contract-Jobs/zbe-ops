"use client";

import { useSession } from "@/lib/auth/client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: sessionData, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isPending) return;

    if (!sessionData?.user && pathname !== "/login") {
      router.push("/login");
    } else if (sessionData?.user && pathname === "/login") {
      router.push("/");
    }
  }, [sessionData?.user, isPending, pathname, router]);

  if (isPending) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <p className="text-sm font-medium tracking-wide text-black/50">Loading ZBE Ops desk...</p>
      </div>
    );
  }

  // Prevent flash of protected content before redirect
  if (!sessionData?.user && pathname !== "/login") {
    return null;
  }

  return <>{children}</>;
}
