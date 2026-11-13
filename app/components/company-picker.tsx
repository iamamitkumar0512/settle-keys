"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DEFAULT_COMPANY, accountUrl } from "@/lib/near";

/** Which company a page shows: ?company=... in the URL, else the demo company. */
export function useCompanyId(): string {
  const params = useSearchParams();
  return params.get("company") ?? DEFAULT_COMPANY;
}

export function CompanyPicker({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [text, setText] = useState(companyId);
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const id = text.trim();
        router.push(id && id !== DEFAULT_COMPANY ? `?company=${encodeURIComponent(id)}` : "?");
      }}
    >
      <label className="label" htmlFor="company">
        Company
      </label>
      <input id="company" className="input h-10 w-[300px] font-mono text-[13px]" value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit" className="btn h-10 min-h-0">
        Open
      </button>
      <a href={accountUrl(companyId)} target="_blank" rel="noreferrer" className="text-[13px] text-accent-text">
        explorer
      </a>
    </form>
  );
}
