"use client";

import { useCallback, useEffect, useState } from "react";
import { CompanyPicker, useCompanyId } from "./company-picker";
import { KeyBox } from "./key-box";
import { OutcomeCard } from "./outcome";
import { CopyButton } from "./copy-button";
import type { HeldKey } from "@/lib/keys";
import {
  DEFAULT_SUPPLIER,
  call,
  company,
  fmtNanos,
  fmtUsdc,
  newKeyPair,
  shortKey,
  signerFor,
  toUnits,
  type Entry,
  type MemberView,
  type Outcome,
} from "@/lib/near";

type Company = Awaited<ReturnType<typeof company>>;

export function TeamPage() {
  const companyId = useCompanyId();
  const [data, setData] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<HeldKey | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await company(companyId));
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "could not load the company");
    }
  }, [companyId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl">Team</h1>
          <p className="text-muted">Every person gets a key with a limit. Removing someone is deleting their key.</p>
        </div>
        <CompanyPicker companyId={companyId} />
      </div>

      {error && <p className="well border-late text-late">{error}</p>}

      {data && (
        <section className="card grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <p className="label">Balance</p>
            <p className="figure text-2xl">{fmtUsdc(data.balance)}</p>
          </div>
          <div>
            <p className="label">Members</p>
            <p className="figure text-2xl">{data.members.filter((m) => !m.root).length}</p>
          </div>
          <div>
            <p className="label">Payments</p>
            <p className="figure text-2xl">{data.ledger.filter((e) => e.status === "Paid").length}</p>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <Members companyId={companyId} members={data?.members ?? []} owner={owner} onChanged={refresh} />
          <Ledger ledger={data?.ledger ?? []} />
        </div>
        <div className="flex flex-col gap-6">
          <KeyBox
            companyId={companyId}
            role="owner"
            title="Owner key"
            hint="Paste the founder's owner key to add or remove members. On chain it can call only add_owner, add_member and remove_member. It cannot pay."
            onChange={setOwner}
          />
          {owner && <AddMember companyId={companyId} owner={owner} onAdded={refresh} />}
        </div>
      </div>
    </>
  );
}

function Members({
  companyId,
  members,
  owner,
  onChanged,
}: {
  companyId: string;
  members: MemberView[];
  owner: HeldKey | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [arming, setArming] = useState<string | null>(null);
  const [last, setLast] = useState<{ title: string; outcome: Outcome } | null>(null);

  // Two clicks to remove: the first arms the button for a few seconds, the second removes.
  async function remove(m: MemberView) {
    if (!owner) return;
    if (arming !== m.key) {
      setArming(m.key);
      setTimeout(() => setArming((a) => (a === m.key ? null : a)), 5000);
      return;
    }
    setArming(null);
    setBusy(m.key);
    const outcome = await call(signerFor(companyId, owner.private_key), companyId, "remove_member", { key: m.key }, 30);
    setLast({ title: `Remove ${m.name}`, outcome });
    setBusy(null);
    onChanged();
  }

  return (
    <section className="card flex flex-col gap-4 p-5">
      <h2 className="display text-lg">Members</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Who</th>
            <th>Can</th>
            <th>Spent today</th>
            <th>Key</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.key}>
              <td className="font-medium">{m.name}</td>
              <td className="text-muted">
                {m.root
                  ? "Deploy key: full access, used once, kept offline"
                  : m.role === "Owner"
                    ? "Add and remove members. Cannot pay."
                    : `Pay ${m.policy!.suppliers.join(", ")} up to ${fmtUsdc(m.policy!.per_payment)} a payment, ${fmtUsdc(m.policy!.per_day)} a day` +
                      (m.policy!.expires_at ? `, until ${fmtNanos(m.policy!.expires_at)}` : "")}
              </td>
              <td className="figure">{m.role === "Member" ? fmtUsdc(m.spent_today) : "—"}</td>
              <td className="figure text-[13px] text-muted" title={m.key}>
                {shortKey(m.key)}
              </td>
              <td>
                {owner && !m.root && m.key !== owner.public_key && (
                  <button
                    type="button"
                    className={`btn h-9 min-h-0 px-3 text-[13px] ${arming === m.key ? "border-late text-late" : ""}`}
                    disabled={busy === m.key}
                    onClick={() => remove(m)}
                  >
                    {busy === m.key ? "Removing…" : arming === m.key ? `Remove ${m.name}?` : "Remove"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {last && <OutcomeCard title={last.title} outcome={last.outcome} verb="removed" />}
    </section>
  );
}

function AddMember({ companyId, owner, onAdded }: { companyId: string; owner: HeldKey; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [suppliers, setSuppliers] = useState(DEFAULT_SUPPLIER);
  const [perPayment, setPerPayment] = useState("20");
  const [perDay, setPerDay] = useState("20");
  const [hours, setHours] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ name: string; key: ReturnType<typeof newKeyPair>; outcome: Outcome } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const key = newKeyPair();
    const h = Number(hours);
    const policy = {
      suppliers: suppliers.split(",").map((s) => s.trim()).filter(Boolean),
      per_payment: toUnits(perPayment).toString(),
      per_day: toUnits(perDay).toString(),
      expires_at: h > 0 ? (BigInt(Date.now() + h * 3_600_000) * 1_000_000n).toString() : null,
    };
    const outcome = await call(signerFor(companyId, owner.private_key), companyId, "add_member", { key: key.public_key, name, policy }, 30);
    setIssued({ name, key, outcome });
    setBusy(false);
    onAdded();
  }

  const keyJson = issued ? JSON.stringify({ name: issued.name, ...issued.key }) : "";

  return (
    <section className="card flex flex-col gap-4 p-5">
      <h2 className="display text-lg">Issue a key</h2>
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <label className="field">
          <span className="label">Name</span>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Anita" />
        </label>
        <label className="field">
          <span className="label">Suppliers they may pay</span>
          <input className="input font-mono text-[13px]" required value={suppliers} onChange={(e) => setSuppliers(e.target.value)} />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="field">
            <span className="label">Per payment</span>
            <input className="input" required value={perPayment} onChange={(e) => setPerPayment(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Per day</span>
            <input className="input" required value={perDay} onChange={(e) => setPerDay(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Hours</span>
            <input className="input" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="∞" />
          </label>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Issuing…" : "Issue key"}
        </button>
      </form>
      {issued && (
        <div className="flex flex-col gap-3">
          <OutcomeCard title={`Issue a key to ${issued.name}`} outcome={issued.outcome} verb="issued" />
          {issued.outcome.ok && (
            <div className="well flex flex-col gap-2">
              <p className="text-[13px] text-muted">
                Give this to {issued.name}. It is shown once. On chain it can call only <span className="figure">pay</span>.
              </p>
              <code className="break-all font-mono text-[12px]/[18px]">{keyJson}</code>
              <div>
                <CopyButton text={keyJson} label="Copy key" />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Ledger({ ledger }: { ledger: Entry[] }) {
  const rows = [...ledger].reverse();
  return (
    <section className="card flex flex-col gap-4 p-5">
      <h2 className="display text-lg">Ledger</h2>
      {rows.length === 0 ? (
        <p className="text-muted">No payments yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Status</th>
              <th>Who</th>
              <th>Amount</th>
              <th>To</th>
              <th>Memo</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="figure">{e.id}</td>
                <td>
                  <span className={`pill ${e.status === "Paid" ? "tone-paid" : e.status === "Failed" ? "tone-late" : "tone-due"}`}>{e.status}</span>
                </td>
                <td>{e.member}</td>
                <td className="figure">{fmtUsdc(e.amount)}</td>
                <td className="font-mono text-[13px]">{e.to}</td>
                <td className="text-muted">{e.memo}</td>
                <td className="text-[13px] text-muted">{fmtNanos(e.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

