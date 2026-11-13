"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCompanyId } from "./company-picker";
import { DEFAULT_SUPPLIER, accountUrl, fmtNanos, fmtUsdc, view, type Entry } from "@/lib/near";

export function SupplierPage() {
  const companyId = useCompanyId();
  const params = useSearchParams();
  const supplier = params.get("account") ?? DEFAULT_SUPPLIER;
  const [usdc, setUsdc] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [orders, setOrders] = useState<Entry[]>([]);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const seen = useRef<Set<number> | null>(null);

  const refresh = useCallback(async () => {
    const token = usdc ?? (await view<string>(companyId, "get_usdc"));
    if (!usdc) setUsdc(token);
    const [bal, ledger] = await Promise.all([
      view<string>(token, "ft_balance_of", { account_id: supplier }),
      view<Entry[]>(companyId, "get_ledger", { from: 0, limit: 200 }),
    ]);
    setBalance(bal);
    const mine = ledger.filter((e) => e.to === supplier && e.status === "Paid").reverse();
    if (seen.current === null) {
      seen.current = new Set(mine.map((e) => e.id));
    } else {
      const now = new Set<number>();
      for (const e of mine) if (!seen.current.has(e.id)) now.add(e.id);
      if (now.size > 0) {
        setFresh(now);
        for (const id of now) seen.current.add(id);
        setTimeout(() => setFresh(new Set()), 6000);
      }
    }
    setOrders(mine);
  }, [companyId, supplier, usdc]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <>
      <div>
        <h1 className="display text-3xl">Supplier</h1>
        <p className="text-muted">
          What <span className="font-mono text-[13px] text-ink">{supplier}</span> sees. An order appears here the moment the payment lands.
        </p>
      </div>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <p className="label">Received, in total</p>
          <p className="figure text-2xl">{balance === null ? "…" : fmtUsdc(balance)}</p>
          <a href={accountUrl(supplier)} target="_blank" rel="noreferrer" className="text-[13px] text-accent-text">
            explorer
          </a>
        </div>
        <div>
          <p className="label">Orders from {companyId.split(".")[0]}</p>
          <p className="figure text-2xl">{orders.length}</p>
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <h2 className="display text-lg">Orders</h2>
        {orders.length === 0 ? (
          <p className="text-muted">Nothing yet. Waiting for a payment…</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {orders.map((e) => (
              <li
                key={e.id}
                className={`well flex flex-wrap items-center justify-between gap-3 transition-colors duration-1000 ${fresh.has(e.id) ? "border-accent-text" : ""}`}
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    Order {e.memo} {fresh.has(e.id) && <span className="pill tone-paid ml-2">just landed</span>}
                  </span>
                  <span className="text-[13px] text-muted">
                    from {e.member} · {fmtNanos(e.at)}
                  </span>
                </div>
                <span className="figure text-xl">{fmtUsdc(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
