import { notFound } from "next/navigation";
import { APPROVALS_VISIBLE } from "@/lib/features";

// Approvals is hidden for now (see lib/features.ts): /approvals and
// /approvals/[id] answer 404.
export default function ApprovalsLayout({ children }: { children: React.ReactNode }) {
  if (!APPROVALS_VISIBLE) notFound();
  return children;
}
