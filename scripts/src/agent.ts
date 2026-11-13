// The restock agent: a script that holds a member key, nothing more. It buys milk when stock is
// low, within the limits on its key. When it is handed a poisoned invoice, the contract refuses.
//
//   pnpm near:member --name Agent --supplier milk-supplier.settlekeys.testnet \
//     --per-payment 5 --per-day 5 --hours 12
//   pnpm near:agent [--as agent]

import { COMPANY, SUPPLIER, flags, need, toUnits, fmtUsdc } from "./lib/config.js";
import { call, printOutcome, signerFor, view } from "./lib/chain.js";
import { loadKey } from "./lib/keys.js";

const f = flags();
const as = need(f, "as", "agent");
const key = loadKey(COMPANY, as);
const signer = signerFor(COMPANY, key.private_key);
const member = await view<{ policy: { suppliers: string[]; per_payment: string; per_day: string } | null; spent_today: string } | null>(
  COMPANY,
  "get_member",
  { key: key.public_key },
);
if (!member?.policy) throw new Error(`${as} is not a member key on ${COMPANY}`);
const { policy } = member;

console.log(`The restock agent holds a member key on ${COMPANY}.`);
console.log(`Its limits: ${policy.suppliers.join(", ")}, ${fmtUsdc(policy.per_payment)} a payment, ${fmtUsdc(policy.per_day)} a day.\n`);

// 1. The stockroom. In the demo it is a constant; a real agent would read inventory.
const stock = { milk: 2, minimum: 6, pricePerLitre: "0.3125" };
const litres = stock.minimum - stock.milk;
const bill = toUnits(stock.pricePerLitre) * BigInt(litres);
console.log(`1. Stock check: ${stock.milk} litres of milk, minimum ${stock.minimum}. Order ${litres} litres for ${fmtUsdc(bill)}.`);

const milk = await call(signer, "pay", { to: SUPPLIER, amount: bill.toString(), memo: `milk-${Date.now()}` }, 60);
printOutcome(`   The agent pays the supplier ${fmtUsdc(bill)}`, milk, "paid");

// 2. A poisoned invoice arrives: a different account and a much larger amount.
const poisoned = { to: "attacker.testnet", amount: toUnits("80"), memo: `invoice-${Date.now()}` };
console.log(`\n2. An invoice arrives: ${fmtUsdc(poisoned.amount)} to ${poisoned.to}. The agent believes it and tries to pay.`);
const attack = await call(signer, "pay", { to: poisoned.to, amount: poisoned.amount.toString(), memo: poisoned.memo }, 60);
printOutcome(`   The agent pays ${poisoned.to} ${fmtUsdc(poisoned.amount)}`, attack, "paid");

// 3. The same invoice, redirected to the real supplier, still breaks the per-payment limit.
console.log(`\n3. The invoice is rewritten to the real supplier, still for ${fmtUsdc(poisoned.amount)}.`);
const overCap = await call(signer, "pay", { to: SUPPLIER, amount: poisoned.amount.toString(), memo: poisoned.memo + "-b" }, 60);
printOutcome(`   The agent pays ${SUPPLIER} ${fmtUsdc(poisoned.amount)}`, overCap, "paid");

const after = await view<{ spent_today: string } | null>(COMPANY, "get_member", { key: key.public_key });
console.log(`\nThe agent spent ${fmtUsdc(after?.spent_today ?? "0")} today. Nothing could go past the limits on its key.`);
if (!milk.ok || attack.ok || overCap.ok) process.exitCode = 1;
