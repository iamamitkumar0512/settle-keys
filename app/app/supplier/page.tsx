import { Suspense } from "react";
import { SupplierPage } from "@/components/supplier-page";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <SupplierPage />
    </Suspense>
  );
}
