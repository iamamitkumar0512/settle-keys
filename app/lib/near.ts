// Talking to the company contract from the browser: views, one signer per key, and the
// contract's own words when it refuses.

import { Account, JsonRpcProvider, KeyPair, actions, teraToGas, type KeyPairString } from "near-api-js";

// FastNEAR answers browsers; rpc.testnet.near.org refuses cross-origin requests.
export const RPC_URL = process.env.NEXT_PUBLIC_NEAR_RPC_URL ?? "https://test.rpc.fastnear.com";
export const EXPLORER = "https://testnet.nearblocks.io";
export const DEFAULT_COMPANY = process.env.NEXT_PUBLIC_COMPANY ?? "chaipoint.settlekeys.testnet";
export const DEFAULT_SUPPLIER = process.env.NEXT_PUBLIC_SUPPLIER ?? "milk-supplier.settlekeys.testnet";
export const ONE_USDC = 1_000_000n;

export const provider = new JsonRpcProvider({ url: RPC_URL });

export interface Policy {
  suppliers: string[];
  per_payment: string;
  per_day: string;
  expires_at: string | null;
}
export interface MemberView {
  key: string;
  name: string;
  role: "Owner" | "Member";
  root: boolean;
  policy: Policy | null;
  spent_today: string;
  added_at: string;
}
export interface Entry {
  id: number;
  key: string;
  member: string;
  to: string;
  amount: string;
  memo: string;
  status: "Pending" | "Paid" | "Failed";
  at: string;
}

export async function view<T>(contractId: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  return (await provider.callFunction<any>({ contractId, method, args })) as T;
}

export async function company(id: string) {
  const [usdc, members, ledger] = await Promise.all([
    view<string>(id, "get_usdc"),
    view<MemberView[]>(id, "get_members"),
    view<Entry[]>(id, "get_ledger", { from: 0, limit: 200 }),
  ]);
  const balance = await view<string>(usdc, "ft_balance_of", { account_id: id });
  return { usdc, members, ledger, balance };
}

export function signerFor(companyId: string, privateKey: KeyPairString): Account {
  return new Account(companyId, provider, privateKey);
}

export interface Outcome {
  ok: boolean;
  hash: string;
  reason?: string;
  events: any[];
}

/** Call a method on the company contract and explain what happened, without throwing. */
export async function call(account: Account, contractId: string, method: string, args: object, gasTgas = 60): Promise<Outcome> {
  try {
    const res: any = await account.signAndSendTransaction({
      receiverId: contractId,
      actions: [actions.functionCall(method, args, teraToGas(gasTgas), 0n)],
      waitUntil: "FINAL",
      throwOnFailure: false,
    });
    return explain(res);
  } catch (err: any) {
    return { ok: false, hash: "", reason: short(err?.message ?? String(err)), events: [] };
  }
}

export function explain(res: any): Outcome {
  const hash: string = res?.transaction?.hash ?? "";
  const events: any[] = [];
  for (const r of res?.receipts_outcome ?? []) {
    for (const line of r?.outcome?.logs ?? []) {
      if (typeof line === "string" && line.startsWith("EVENT_JSON:")) {
        try {
          events.push(JSON.parse(line.slice(11)));
        } catch {}
      }
    }
  }
  const status = res?.status;
  if (status && typeof status === "object" && "Failure" in status) {
    const text = JSON.stringify(status.Failure);
    const m = /Smart contract panicked: ([^"]+)/.exec(text) ?? /"ExecutionError":"([^"]+)"/.exec(text);
    return { ok: false, hash, reason: m ? m[1].replace(/\\"/g, '"') : short(text), events };
  }
  return { ok: true, hash, events };
}

function short(text: string): string {
  return text.length > 240 ? text.slice(0, 240) + "…" : text;
}

export function txUrl(hash: string): string {
  return `${EXPLORER}/txns/${hash}`;
}
export function accountUrl(id: string): string {
  return `${EXPLORER}/address/${id}`;
}

export function toUnits(amount: string): bigint {
  const [whole, frac = ""] = amount.trim().split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(frac) || frac.length > 6) throw new Error(`not an amount: ${amount}`);
  return BigInt(whole) * ONE_USDC + BigInt((frac + "000000").slice(0, 6));
}

export function fmtUsdc(units: bigint | string | number): string {
  const u = BigInt(units);
  const whole = u / ONE_USDC;
  let frac = (u % ONE_USDC).toString().padStart(6, "0");
  while (frac.length > 2 && frac.endsWith("0")) frac = frac.slice(0, -1);
  return `${whole}.${frac} USDC`;
}

export function shortKey(key: string): string {
  const [curve, rest = ""] = key.split(":");
  return `${curve}:${rest.slice(0, 6)}…${rest.slice(-4)}`;
}

export function fmtNanos(nanos: string): string {
  return new Date(Number(BigInt(nanos) / 1_000_000n)).toLocaleString();
}

export function newKeyPair(): { public_key: string; private_key: KeyPairString } {
  const pair = KeyPair.fromRandom("ed25519");
  return { public_key: pair.getPublicKey().toString(), private_key: pair.toString() };
}

/** Accepts the JSON a script saved, or a bare "ed25519:..." private key. */
export function parseKey(text: string): { name?: string; public_key: string; private_key: KeyPairString } {
  const t = text.trim();
  if (t.startsWith("{")) {
    const j = JSON.parse(t);
    if (!j.private_key) throw new Error("no private_key in that JSON");
    const pair = KeyPair.fromString(j.private_key);
    return { name: j.name, public_key: pair.getPublicKey().toString(), private_key: j.private_key };
  }
  const pair = KeyPair.fromString(t as KeyPairString);
  return { public_key: pair.getPublicKey().toString(), private_key: t as KeyPairString };
}
