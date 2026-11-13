// Remove a member. The owner key signs; the company account deletes the member's key.
//
//   pnpm near:remove --member anita [--by priya]

import { COMPANY, flags, need } from "./lib/config.js";
import { call, printOutcome, signerFor, waitUntilKeyGone } from "./lib/chain.js";
import { loadKey } from "./lib/keys.js";

const f = flags();
const member = need(f, "member");
const by = need(f, "by", "priya");
const owner = loadKey(COMPANY, by);
const gone = loadKey(COMPANY, member);
const signer = signerFor(COMPANY, owner.private_key);

const outcome = await call(signer, "remove_member", { key: gone.public_key }, 30);
printOutcome(`Remove ${gone.name ?? member}'s key`, outcome);
if (outcome.ok) {
  await waitUntilKeyGone(COMPANY, gone.public_key);
  console.log(`  the key is no longer on ${COMPANY}; a payment with it now fails before any check`);
} else {
  process.exitCode = 1;
}
