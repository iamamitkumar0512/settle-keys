// Server side of the hosted demo. The app holds one owner key for the demo company. An owner
// key can add and remove members and cannot pay, so a leak of it cannot move the USDC.

import "server-only";
import { Account, JsonRpcProvider, KeyPair, actions, teraToGas, type KeyPairString } from "near-api-js";

export const DEMO_COMPANY = process.env.DEMO_COMPANY ?? "demo.settlekeys.testnet";
export const DEMO_SUPPLIER = process.env.DEMO_SUPPLIER ?? "milk-supplier.settlekeys.testnet";
const RPC_URL = process.env.NEAR_RPC_URL ?? "https://rpc.testnet.near.org";
const ONE_USDC = 1_000_000n;

/** The demo key's limits: one supplier, 1 USDC a payment and a day, gone in an hour. */
export const DEMO_POLICY = {
  per_payment: ONE_USDC.toString(),
  per_day: ONE_USDC.toString(),
  hours: 1,
};

export const provider = new JsonRpcProvider({ url: RPC_URL });

export function ownerAccount(): Account {
  const key = process.env.DEMO_OWNER_KEY as KeyPairString | undefined;
  if (!key) throw new Error("DEMO_OWNER_KEY is not set");
  return new Account(DEMO_COMPANY, provider, key);
}

export async function view<T>(contractId: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  return (await provider.callFunction<any>({ contractId, method, args })) as T;
}

/** Calls a method on the demo company as the owner and throws with the contract's words on refusal. */
export async function asOwner(method: string, args: object): Promise<string> {
  const res: any = await ownerAccount().signAndSendTransaction({
    receiverId: DEMO_COMPANY,
    actions: [actions.functionCall(method, args, teraToGas(30), 0n)],
    waitUntil: "FINAL",
    throwOnFailure: false,
  });
  const status = res?.status;
  if (status && typeof status === "object" && "Failure" in status) {
    const text = JSON.stringify(status.Failure);
    const m = /Smart contract panicked: ([^"]+)/.exec(text);
    throw new Error(m ? m[1] : text.slice(0, 200));
  }
  return res?.transaction?.hash ?? "";
}

export function newMemberKey(): { public_key: string; private_key: KeyPairString } {
  const pair = KeyPair.fromRandom("ed25519");
  return { public_key: pair.getPublicKey().toString(), private_key: pair.toString() };
}

export function nanosFromNow(hours: number): string {
  return (BigInt(Date.now() + hours * 3_600_000) * 1_000_000n).toString();
}

// Best-effort rate limit per instance: a judge reruns a few times, a loop does not drain the company.
const recent = new Map<string, number[]>();
export function allow(ip: string, perHour = 6): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (hits.length >= perHour) return false;
  hits.push(now);
  recent.set(ip, hits);
  return true;
}
