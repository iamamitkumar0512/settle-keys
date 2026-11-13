"use client";

import { useCallback, useEffect, useState } from "react";
import { CompanyPicker, useCompanyId } from "./company-picker";
import { KeyBox } from "./key-box";
import { OutcomeCard } from "./outcome";
import type { HeldKey } from "@/lib/keys";
import { call, fmtNanos, fmtUsdc, signerFor, toUnits, view, type MemberView, type Outcome } from "@/lib/near";

export function PayPage() {
  const companyId = useCompanyId();
  const [held, setHeld] = useState<HeldKey | null>(null);
  const [me, setMe] = useState<MemberView | null | undefined>(undefined);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("4");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ title: string; outcome: Outcome }[]>([]);

  const refresh = useCallback(async () => {
    if (!held) {
      setMe(undefined);
      return;
    }
    const m = await view<MemberView | null>(companyId, "get_member", { key: held.public_key });
    setMe(m);
    if (m?.policy && !to) setTo(m.policy.suppliers[0]);
  }, [companyId, held, to]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!held) return;
    setBusy(true);
    const units = toUnits(amount);
    const m = memo.trim() || `order-${Date.now()}`;
    const outcome = await call(signerFor(companyId, held.private_key), companyId, "pay", { to, amount: units.toString(), memo: m }, 60);
    setResults((r) => [{ title: `${held.name ?? "This key"} pays ${to} ${fmtUsdc(units)}, memo ${m}`, outcome }, ...r]);
    setBusy(false);
    setMemo("");
    refresh();
  }

  const policy = me?.policy ?? null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl">Pay</h1>
          <p className="text-muted">One signature. The contract checks the key's limits and moves the money in the same transaction.</p>
        </div>
        <CompanyPicker companyId={companyId} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-6">
          <KeyBox
            companyId={companyId}
            role="member"
            title="Your key"
            hint="Paste the key the founder issued you. On chain it can call only pay, and only on this company."
            onChange={setHeld}
          />
          {held && me === null && (
            <p className="well border-late text-late">This key is not on {companyId}. It was removed, or it was issued for another company.</p>
          )}
          {policy && (
            <section className="card flex flex-col gap-2 p-5">
              <h2 className="display text-lg">Your limits</h2>
              <p>
                Suppliers: <span className="font-mono text-[13px]">{policy.suppliers.join(", ")}</span>
              </p>
              <p>
                Up to <span className="figure">{fmtUsdc(policy.per_payment)}</span> a payment, <span className="figure">{fmtUsdc(policy.per_day)}</span> a day
              </p>
              <p>
                Spent today: <span className="figure">{fmtUsdc(me!.spent_today)}</span>
              </p>
              {policy.expires_at && <p className="text-muted">Until {fmtNanos(policy.expires_at)}</p>}
            </section>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <section className="card flex flex-col gap-4 p-5">
            <h2 className="display text-lg">Pay a supplier</h2>
            <form className="flex flex-col gap-3" onSubmit={pay}>
              <label className="field">
                <span className="label">To</span>
                <input className="input font-mono text-[13px]" required value={to} onChange={(e) => setTo(e.target.value)} placeholder="milk-supplier.settlekeys.testnet" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  <span className="label">Amount (USDC)</span>
                  <input className="input" required value={amount} onChange={(e) => setAmount(e.target.value)} />
                </label>
                <label className="field">
                  <span className="label">Memo</span>
                  <input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="order-1" />
                </label>
              </div>
              <button type="submit" className="btn btn-primary" disabled={!held || busy}>
                {busy ? "Paying…" : `Pay ${amount || "0"} USDC`}
              </button>
            </form>
          </section>
          {results.map((r, i) => (
            <OutcomeCard key={i} title={r.title} outcome={r.outcome} verb="paid" />
          ))}
        </div>
      </div>
    </>
  );
}
