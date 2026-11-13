// Keys the browser holds for this demo, in localStorage, one per company and role.
// This is a testnet demo: a real deployment would use a wallet.

import type { KeyPairString } from "near-api-js";

export interface HeldKey {
  name?: string;
  public_key: string;
  private_key: KeyPairString;
}

function slot(companyId: string, role: "owner" | "member"): string {
  return `settlekeys:${companyId}:${role}`;
}

export function loadHeldKey(companyId: string, role: "owner" | "member"): HeldKey | null {
  try {
    const raw = localStorage.getItem(slot(companyId, role));
    return raw ? (JSON.parse(raw) as HeldKey) : null;
  } catch {
    return null;
  }
}

export function saveHeldKey(companyId: string, role: "owner" | "member", key: HeldKey): void {
  try {
    localStorage.setItem(slot(companyId, role), JSON.stringify(key));
  } catch {}
}

export function forgetHeldKey(companyId: string, role: "owner" | "member"): void {
  try {
    localStorage.removeItem(slot(companyId, role));
  } catch {}
}
