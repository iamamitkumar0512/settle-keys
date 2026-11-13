// Talking to the contract: one signer per key, readable outcomes, and the refusal message
// when the contract says no.

import { Account, JsonRpcProvider, actions, teraToGas, type KeyPairString } from "near-api-js";
import { COMPANY, RPC_URL, txUrl } from "./config.js";

export const provider = new JsonRpcProvider({ url: RPC_URL });

/** An Account object that signs for `company` with the given key. */
export function signerFor(company: string, privateKey: KeyPairString): Account {
  return new Account(company, provider, privateKey);
}

export async function view<T>(contractId: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  return (await provider.callFunction<any>({ contractId, method, args })) as T;
}

export interface Outcome {
  ok: boolean;
  hash: string;
  url: string;
  /** The contract's own words when it refused, or the protocol's. */
  reason?: string;
  /** EVENT_JSON lines the contract logged. */
  events: any[];
  /** Whatever the method returned, if it succeeded. */
  result?: any;
}

/** Call a method on the company contract and explain what happened, without throwing. */
export async function call(
  account: Account,
  method: string,
  args: object,
  gasTgas = 60,
  contractId: string = COMPANY,
): Promise<Outcome> {
  try {
    const res: any = await account.signAndSendTransaction({
      receiverId: contractId,
      actions: [actions.functionCall(method, args, teraToGas(gasTgas), 0n)],
      waitUntil: "FINAL",
      throwOnFailure: false,
    });
    return explain(res);
  } catch (err: any) {
    // The RPC refused the transaction before it ran (bad key, wrong receiver, ...).
    return { ok: false, hash: "", url: "", reason: shortError(err), events: [] };
  }
}

/** Turn an RPC transaction response into something a person can read. */
export function explain(res: any): Outcome {
  const hash: string = res?.transaction?.hash ?? "";
  const events: any[] = [];
  for (const r of res?.receipts_outcome ?? []) {
    for (const line of r?.outcome?.logs ?? []) {
      if (typeof line === "string" && line.startsWith("EVENT_JSON:")) {
        try {
          events.push(JSON.parse(line.slice("EVENT_JSON:".length)));
        } catch {}
      }
    }
  }
  const status = res?.status ?? res?.final_execution_status;
  if (status && typeof status === "object" && "Failure" in status) {
    return { ok: false, hash, url: txUrl(hash), reason: panicMessage(status.Failure) ?? shortError(status.Failure), events };
  }
  let result: any;
  const value = status && typeof status === "object" ? status.SuccessValue : undefined;
  if (typeof value === "string" && value.length > 0) {
    try {
      result = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
    } catch {}
  }
  return { ok: true, hash, url: txUrl(hash), events, result };
}

/** "Smart contract panicked: <message>" -> "<message>". */
function panicMessage(failure: any): string | undefined {
  const text = JSON.stringify(failure);
  const m = /Smart contract panicked: ([^"]+)/.exec(text);
  if (m) return m[1].replace(/\\"/g, '"');
  const e = /"ExecutionError":"([^"]+)"/.exec(text);
  return e?.[1];
}

function shortError(err: any): string {
  const text = typeof err === "string" ? err : err?.message ?? JSON.stringify(err);
  return text.length > 300 ? text.slice(0, 300) + "..." : text;
}

/** Wait until the key is no longer on the account (so a payment after `remove` really fails). */
export async function waitUntilKeyGone(accountId: string, publicKey: string, attempts = 20): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      await provider.viewAccessKey({ accountId, publicKey, finality: "final" } as any);
    } catch {
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`key ${publicKey} is still on ${accountId} after ${attempts}s`);
}

export function printOutcome(title: string, o: Outcome, verb = "done"): void {
  console.log(`\n${title}`);
  if (o.ok) {
    console.log(`  ${verb}: yes`);
  } else {
    console.log(`  refused: ${o.reason}`);
  }
  if (o.hash) console.log(`  tx: ${o.url}`);
  for (const e of o.events) {
    if (e?.standard === "settle_keys") console.log(`  event: ${e.event} ${JSON.stringify(e.data?.[0] ?? {})}`);
  }
}
