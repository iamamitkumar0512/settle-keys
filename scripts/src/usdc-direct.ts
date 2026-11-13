// A member key tries to move the company's USDC by calling the token directly, skipping the
// contract. The protocol refuses: the key is locked to the company contract.
//
//   pnpm near:usdc-direct [--as anita] [--to stranger.testnet] [--amount 4]

import { COMPANY, flags, need, toUnits, fmtUsdc } from "./lib/config.js";
import { call, printOutcome, signerFor, view } from "./lib/chain.js";
import { loadKey } from "./lib/keys.js";

const f = flags();
const as = need(f, "as", "anita");
const to = need(f, "to", "stranger.testnet");
const amount = toUnits(need(f, "amount", "4"));
const key = loadKey(COMPANY, as);
const usdc = await view<string>(COMPANY, "get_usdc");
const signer = signerFor(COMPANY, key.private_key);

const outcome = await call(signer, "ft_transfer", { receiver_id: to, amount: amount.toString() }, 30, usdc);
printOutcome(`${key.name ?? as}'s key calls the USDC token directly for ${fmtUsdc(amount)} to ${to}`, outcome);
console.log(outcome.ok ? "  this should never happen" : "  refused by the protocol before the contract ran: the key only works on the company contract");
if (outcome.ok) process.exitCode = 1;
