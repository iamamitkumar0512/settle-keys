// Try Settle Keys in one command, with no account and no faucet. The hosted app issues you a
// fresh member key on the demo company (one supplier, a small limit, expires in an hour). You pay
// the supplier once, then try to pay a stranger and watch the contract refuse.
//
//   pnpm near:demo

import { randomBytes } from "node:crypto";
import { DEMO_URL, accountUrl, toUnits, fmtUsdc } from "./lib/config.js";
import { call, printOutcome, signerFor } from "./lib/chain.js";
import type { KeyPairString } from "near-api-js";

interface DemoKey {
  company: string;
  token: string;
  supplier: string;
  member: { name: string; public_key: string; private_key: KeyPairString };
  policy: { per_payment: string; per_day: string; expires_at: string | null };
}

let demo: DemoKey;
try {
  const res = await fetch(`${DEMO_URL}/api/demo-key`, { method: "POST" });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  demo = (await res.json()) as DemoKey;
} catch (err: any) {
  console.error(`The hosted demo at ${DEMO_URL} did not answer (${err?.message ?? err}).`);
  console.error(`Make your own company instead: pnpm near:setup`);
  process.exit(1);
}

const { company, supplier, member, policy } = demo;
console.log(`The demo company ${company} issued you a member key, ${member.name}.`);
console.log(`It can pay only ${supplier}, up to ${fmtUsdc(policy.per_payment)} a payment and ${fmtUsdc(policy.per_day)} today.`);
console.log(`On chain it can call one method, pay. (${accountUrl(company)})`);

const signer = signerFor(company, member.private_key);
const memo = `demo-${Date.now()}-${randomBytes(3).toString("hex")}`;
const half = toUnits("0.50");

const paid = await call(signer, "pay", { to: supplier, amount: half.toString(), memo }, 60, company);
printOutcome(`1. ${member.name} pays ${supplier} ${fmtUsdc(half)}`, paid, "paid");

const refused = await call(signer, "pay", { to: "stranger.testnet", amount: half.toString(), memo: memo + "-x" }, 60, company);
printOutcome(`2. ${member.name} pays stranger.testnet ${fmtUsdc(half)}`, refused, "paid");

console.log(paid.ok && !refused.ok
  ? `\nThat is Settle Keys: one signature, the policy checked and the money moved in the same transaction, and a refusal in the contract's own words.`
  : `\nSomething is off: the first payment should pass and the second should be refused.`);
if (!paid.ok || refused.ok) process.exitCode = 1;
