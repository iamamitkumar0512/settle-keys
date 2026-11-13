// Issue a key. An owner key signs; the contract adds the new key to the company account itself.
//
//   pnpm near:member --name Anita --supplier milk-supplier.settlekeys.testnet \
//     --per-payment 20 --per-day 20 [--hours 24] [--by priya]
//   pnpm near:member --name Ravi --owner [--by priya]

import { COMPANY, accountUrl, flags, need, toUnits, fmtUsdc } from "./lib/config.js";
import { call, printOutcome, signerFor } from "./lib/chain.js";
import { loadKey, newKey, saveKey } from "./lib/keys.js";

const f = flags();
const name = need(f, "name");
const by = need(f, "by", "priya");
const owner = loadKey(COMPANY, by);
const signer = signerFor(COMPANY, owner.private_key);
const key = newKey(name);

console.log(`Company: ${COMPANY}  (${accountUrl(COMPANY)})`);
console.log(`Signing with ${by}'s key, which can only add and remove members.`);

let outcome;
if (f.owner) {
  outcome = await call(signer, "add_owner", { key: key.public_key, name }, 30);
  printOutcome(`Issue an owner key to ${name}`, outcome);
} else {
  const suppliers = need(f, "supplier").split(",").map((s) => s.trim()).filter(Boolean);
  const perPayment = toUnits(need(f, "per-payment", "20"));
  const perDay = toUnits(need(f, "per-day", need(f, "per-payment", "20")));
  const hours = f.hours ? Number(need(f, "hours")) : undefined;
  const expiresAt = hours ? String(BigInt(Date.now() + hours * 3_600_000) * 1_000_000n) : null;
  const policy = {
    suppliers,
    per_payment: perPayment.toString(),
    per_day: perDay.toString(),
    expires_at: expiresAt,
  };
  outcome = await call(signer, "add_member", { key: key.public_key, name, policy }, 30);
  printOutcome(
    `Issue a member key to ${name}: ${suppliers.join(", ")}, ${fmtUsdc(perPayment)} a payment, ${fmtUsdc(perDay)} a day` +
      (hours ? `, for ${hours} h` : ""),
    outcome,
  );
}

if (outcome.ok) {
  const path = saveKey(COMPANY, name, key);
  console.log(`  key: ${key.public_key}`);
  console.log(`  the private key is saved at ${path} and is not printed`);
  console.log(`  on chain, this key can call only: ${f.owner ? "add_owner, add_member, remove_member" : "pay"}`);
} else {
  process.exitCode = 1;
}
