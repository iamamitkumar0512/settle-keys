import { Suspense } from "react";
import { TeamPage } from "@/components/team-page";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <TeamPage />
    </Suspense>
  );
}
