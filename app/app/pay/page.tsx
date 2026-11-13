import { Suspense } from "react";
import { PayPage } from "@/components/pay-page";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <PayPage />
    </Suspense>
  );
}
