// Where things live on NEAR testnet, and how the scripts find keys.

import { homedir } from "node:os";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const RPC_URL = process.env.NEAR_RPC_URL ?? "https://rpc.testnet.near.org";
export const EXPLORER = "https://testnet.nearblocks.io";

/** Circle's USDC on NEAR testnet (NEP-141, 6 decimals). Needs faucet.circle.com. */
export const CIRCLE_USDC = "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af";
/** A test USDC on NEAR testnet (NEP-141, 6 decimals) with an open `mint`, so no faucet is needed. */
export const TEST_USDC = "usdc.fakes.testnet";

/** Keys live outside the repo: one folder per company, one JSON file per member. */
export const KEYS_DIR = process.env.SETTLE_KEYS_DIR ?? join(homedir(), ".near-credentials", "settlekeys");

/** `setup` writes the company it made here, so the other commands need no flags. */
export const CURRENT_FILE = join(KEYS_DIR, "current");

function currentCompany(): string | undefined {
  try {
    return readFileSync(CURRENT_FILE, "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}

/** The company the scripts act on: COMPANY=..., else the last `setup`, else the demo company. */
export const COMPANY = process.env.COMPANY ?? currentCompany() ?? "chaipoint.settlekeys.testnet";
/** The supplier the demo pays. Override with SUPPLIER=... */
export const SUPPLIER = process.env.SUPPLIER ?? "milk-supplier.settlekeys.testnet";

export const ONE_USDC = 1_000_000n;

export function txUrl(hash: string): string {
  return `${EXPLORER}/txns/${hash}`;
}

export function accountUrl(id: string): string {
  return `${EXPLORER}/address/${id}`;
}

/** "4" or "1.25" -> smallest units of a 6-decimal token. */
export function toUnits(amount: string): bigint {
  const [whole, frac = ""] = amount.trim().split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(frac) || frac.length > 6) {
    throw new Error(`not a USDC amount: ${amount}`);
  }
  return BigInt(whole) * ONE_USDC + BigInt((frac + "000000").slice(0, 6));
}

/** Smallest units -> "4.00 USDC". */
export function fmtUsdc(units: bigint | string): string {
  const u = BigInt(units);
  const whole = u / ONE_USDC;
  let frac = (u % ONE_USDC).toString().padStart(6, "0");
  while (frac.length > 2 && frac.endsWith("0")) frac = frac.slice(0, -1);
  return `${whole}.${frac} USDC`;
}

/** Minimal flag parsing: --name value, --flag. */
export function flags(argv = process.argv.slice(2)): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

export function need(f: Record<string, string | true>, name: string, fallback?: string): string {
  const v = f[name];
  if (typeof v === "string") return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`missing --${name}`);
}
