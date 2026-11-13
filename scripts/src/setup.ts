// Make your own company on NEAR testnet, in a few minutes and with no faucet:
// a fresh account, the contract deployed on it, a balance of the test USDC that anyone can
// mint, and an owner key for the founder. The other commands then act on this company.
//
//   pnpm near:setup [--name my-cafe] [--owner Priya] [--token test|circle]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Account, actions, nearToYocto, teraToGas } from "near-api-js";
import { CIRCLE_USDC, CURRENT_FILE, KEYS_DIR, TEST_USDC, accountUrl, flags, need, fmtUsdc } from "./lib/config.js";
import { call, explain, printOutcome, provider, view } from "./lib/chain.js";
import { newKey, saveKey } from "./lib/keys.js";

const FAUCET = "https://helper.nearprotocol.com/account";
const here = dirname(fileURLToPath(import.meta.url));
const WASM_PATHS = [
  join(here, "..", "..", "contract", "target", "near", "settle_keys.wasm"),
  join(here, "..", "..", "contract", "res", "settle_keys.wasm"),
];

const f = flags();
const ownerName = need(f, "owner", "Priya");
const tokenChoice = need(f, "token", "test");
const usdc = tokenChoice === "circle" ? CIRCLE_USDC : TEST_USDC;
const name = need(f, "name", `settle-${Math.random().toString(36).slice(2, 8)}`);
const company = name.endsWith(".testnet") ? name : `${name}.testnet`;

console.log(`Making ${company} on NEAR testnet, paying with ${usdc}\n`);

// 1. A fresh account from the testnet faucet helper, with a new full-access key: the deploy key.
const deploy = newKey("Deploy key");
const res = await fetch(FAUCET, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ newAccountId: company, newAccountPublicKey: deploy.public_key }),
});
if (!res.ok) {
  throw new Error(`the faucet refused ${company}: ${res.status} ${await res.text()}`);
}
const deployPath = saveKey(company, "deploy", deploy);
console.log(`1. account created: ${accountUrl(company)}`);
console.log(`   deploy key saved at ${deployPath}. It has full access. Keep it offline after this.`);

for (let i = 0; i < 30; i++) {
  try {
    await provider.viewAccount({ accountId: company, finality: "final" } as any);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
const account = new Account(company, provider, deploy.private_key);

// 2. Register on the token, and mint a balance when the token lets anyone mint.
await account.signAndSendTransaction({
  receiverId: usdc,
  actions: [
    actions.functionCall(
      "storage_deposit",
      { account_id: company, registration_only: true },
      teraToGas(30),
      nearToYocto("0.00125"),
    ),
  ],
  waitUntil: "FINAL",
});
if (usdc === TEST_USDC) {
  await account.signAndSendTransaction({
    receiverId: usdc,
    actions: [actions.functionCall("mint", { account_id: company, amount: "100000000" }, teraToGas(30), 0n)],
    waitUntil: "FINAL",
  });
  console.log(`2. registered on ${usdc} and minted 100.00 USDC (a test token anyone can mint)`);
} else {
  console.log(`2. registered on Circle's USDC. Get a balance at https://faucet.circle.com (Near Testnet) for ${company}`);
}

// 3. Deploy the contract and initialise it in the same transaction.
const wasmPath = WASM_PATHS.find((p) => existsSync(p));
if (!wasmPath) throw new Error("no settle_keys.wasm found; run `cargo near build non-reproducible-wasm` in contract/");
const code = new Uint8Array(readFileSync(wasmPath));
const deployed = explain(
  await account.signAndSendTransaction({
    receiverId: company,
    actions: [actions.deployContract(code), actions.functionCall("new", { usdc }, teraToGas(30), 0n)],
    waitUntil: "FINAL",
    throwOnFailure: false,
  }),
);
printOutcome(`3. deploy the contract from ${wasmPath.includes("/res/") ? "contract/res" : "contract/target"}`, deployed, "deployed");
if (!deployed.ok) process.exit(1);

// 4. The founder's daily key: an owner key, which can hire and fire and cannot pay.
const owner = newKey(ownerName);
const issued = await call(account, "add_owner", { key: owner.public_key, name: ownerName }, 30, company);
printOutcome(`4. issue ${ownerName}'s owner key`, issued, "issued");
if (!issued.ok) process.exit(1);
saveKey(company, ownerName, owner);

// 5. Remember this company for the other commands.
mkdirSync(KEYS_DIR, { recursive: true });
writeFileSync(CURRENT_FILE, company + "\n");
const balance = await view<string>(usdc, "ft_balance_of", { account_id: company });
console.log(`\nDone. ${company} holds ${fmtUsdc(balance)}. The other commands now act on it.`);
console.log(`Next:`);
console.log(`  pnpm near:member --name Anita --supplier milk-supplier.settlekeys.testnet --per-payment 20 --per-day 20`);
console.log(`  pnpm near:pay --amount 4 --memo order-1`);
console.log(`  pnpm near:pay --to stranger.testnet --amount 4`);
console.log(`  pnpm near:ledger`);
