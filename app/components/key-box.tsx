"use client";

import { useEffect, useState } from "react";
import { parseKey, shortKey } from "@/lib/near";
import { forgetHeldKey, loadHeldKey, saveHeldKey, type HeldKey } from "@/lib/keys";

// Where a key enters the browser: paste the JSON a script saved, or a bare private key.
// It stays in localStorage for this company. A real deployment would use a wallet.
export function KeyBox({
  companyId,
  role,
  title,
  hint,
  onChange,
}: {
  companyId: string;
  role: "owner" | "member";
  title: string;
  hint: string;
  onChange: (key: HeldKey | null) => void;
}) {
  const [held, setHeld] = useState<HeldKey | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const k = loadHeldKey(companyId, role);
    setHeld(k);
    onChange(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, role]);

  function use() {
    try {
      const k = parseKey(text);
      saveHeldKey(companyId, role, k);
      setHeld(k);
      setText("");
      setError(null);
      onChange(k);
    } catch (e: any) {
      setError(e?.message ?? "that is not a key");
    }
  }

  function forget() {
    forgetHeldKey(companyId, role);
    setHeld(null);
    onChange(null);
  }

  return (
    <section className="card flex flex-col gap-3 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="display text-lg">{title}</h2>
        {held && (
          <button type="button" className="btn h-9 min-h-0 px-3 text-[13px]" onClick={forget}>
            Forget key
          </button>
        )}
      </div>
      {held ? (
        <p className="text-muted">
          {held.name ? <span className="text-ink">{held.name}</span> : "A key"} is in this browser:{" "}
          <span className="figure text-ink">{shortKey(held.public_key)}</span>
        </p>
      ) : (
        <>
          <p className="text-muted">{hint}</p>
          <textarea
            className="input min-h-[72px] font-mono text-[13px]"
            placeholder='{"name":"Anita","public_key":"ed25519:…","private_key":"ed25519:…"}'
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error && <p className="text-late text-[13px]">{error}</p>}
          <div>
            <button type="button" className="btn btn-primary" onClick={use} disabled={!text.trim()}>
              Use this key
            </button>
          </div>
        </>
      )}
    </section>
  );
}
