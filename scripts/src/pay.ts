// Pay a supplier with a member key. One signature; the contract checks the policy and transfers.
//
//   pnpm near:pay [--as anita] [--to milk-supplier.settlekeys.testnet] [--amount 4] [--memo order-1]

import { COMPANY, SUPPLIER, flags, need, toUnits, fmtUsdc } from "./lib/config.js";
import { call, printOutcome, signerFor } from "./lib/chain.js";
import { loadKey } from "./lib/keys.js";

const f = flags();
const as = need(f, "as", "anita");
const to = need(f, "to", SUPPLIER);
const amount = toUnits(need(f, "amount", "4"));
const memo = need(f, "memo", `order-${Date.now()}`);

const key = loadKey(COMPANY, as);
const signer = signerFor(COMPANY, key.private_key);

const outcome = await call(signer, "pay", { to, amount: amount.toString(), memo }, 60);
printOutcome(`${key.name ?? as} pays ${to} ${fmtUsdc(amount)}, memo ${memo}`, outcome, "paid");
if (!outcome.ok) process.exitCode = 1;
