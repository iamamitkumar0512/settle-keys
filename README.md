# Settle Keys

A business account on NEAR where every person gets a key with a limit.

A company holds USDC in its own NEAR account. The founder issues each member a key with a policy:
which suppliers it may pay, how much per payment, how much per day, and when it expires. A tool gets
the same kind of key as a person. Removing someone is deleting their key. The company account holds
NEAR for gas. Members never do.

On NEAR an access key can be locked to one contract and named methods. A member's key can call one
method, `pay`, on the company account. The contract, deployed on that account, finds the policy by
the key that signed, checks it, and moves the USDC in the same transaction. NEAR Business and Trezu
approve each payment with signers or votes. Settle Keys approves once, when the key is issued.

Live on NEAR testnet: [the app](https://settle-keys.vercel.app) ·
[chaipoint.settlekeys.testnet](https://testnet.nearblocks.io/address/chaipoint.settlekeys.testnet)
(pays with Circle's USDC) ·
[demo.settlekeys.testnet](https://testnet.nearblocks.io/address/demo.settlekeys.testnet)
(pays with a test USDC anyone can mint, and issues the demo keys below).

## Try it in one command

You need Node 20 or newer and pnpm. No NEAR account, no faucet, no Rust.

```bash
pnpm install
pnpm near:demo
```

The hosted app issues you a member key on the demo company: one supplier, 1 USDC a payment, gone in
an hour. The script pays the supplier once, then tries to pay a stranger. You will see:

```
The demo company demo.settlekeys.testnet issued you a member key, Demo 3YdB1o.
It can pay only milk-supplier.settlekeys.testnet, up to 1.00 USDC a payment and 1.00 USDC today.

1. Demo 3YdB1o pays milk-supplier.settlekeys.testnet 0.50 USDC
  paid: yes
  tx: https://testnet.nearblocks.io/txns/EjT3PuhiV2BwidNW4xsCAmWR1qk2VHy835tB4D6gaySm

2. Demo 3YdB1o pays stranger.testnet 0.50 USDC
  refused: stranger.testnet is not an allowed supplier for this key
  tx: https://testnet.nearblocks.io/txns/FF1cc36xq6QQhUxBBkaThLizASrBozC9sdhxiRpjhmo5
```

Every run gets a new key with an unused limit. The route gives six keys an hour per address.

## Your own company

Setup takes a few minutes: it makes a testnet account through the faucet helper, registers it on a
test USDC and mints 100, deploys the contract from the committed build, and issues the founder's
owner key. Keys are saved under `~/.near-credentials/settlekeys/`, never in the repo. After setup,
every command acts on your company. Each command below is one transaction.

```bash
pnpm near:setup --name my-cafe
```

```
1. account created: https://testnet.nearblocks.io/address/my-cafe.testnet
2. registered on usdc.fakes.testnet and minted 100.00 USDC (a test token anyone can mint)
3. deploy the contract from contract/res
  deployed: yes
4. issue Priya's owner key
  issued: yes
Done. my-cafe.testnet holds 100.00 USDC. The other commands now act on it.
```

Issue Anita a key: one supplier, 20 USDC a payment, 20 a day.

```bash
pnpm near:member --name Anita --supplier milk-supplier.settlekeys.testnet --per-payment 20 --per-day 20
```

```
  done: yes
  key: ed25519:5bmSpb…
  on chain, this key can call only: pay
```

Anita pays the supplier 4 USDC. The order appears on the supplier page of the app.

```bash
pnpm near:pay --amount 4 --memo order-1
```

```
  paid: yes
  event: pay {"id":0,"member":"Anita","to":"milk-supplier.settlekeys.testnet","amount":"4000000","memo":"order-1"}
```

Anita pays someone who is not a supplier. The contract refuses.

```bash
pnpm near:pay --to stranger.testnet --amount 4
```

```
  refused: stranger.testnet is not an allowed supplier for this key
```

Anita pays more than her limit. The contract refuses.

```bash
pnpm near:pay --amount 500
```

```
  refused: over the per-payment limit: 500.00 USDC is more than 20.00 USDC
```

Anita's key tries to move the company's USDC by calling the token directly, skipping the contract.
The protocol refuses before any code runs, because the key is locked to the company account.

```bash
pnpm near:usdc-direct
```

```
  refused: Access key receiver my-cafe.testnet does not match transaction receiver 3e2210e1…
```

The founder removes Anita. The company account deletes her key.

```bash
pnpm near:remove --member anita
pnpm near:pay --amount 4
```

```
  removed: yes
  the key is no longer on my-cafe.testnet; a payment with it now fails before any check

  refused: Access key ed25519:5bmSpb… does not exist at block height …
```

The restock agent is a script that holds a member key of the same kind. Give it one with a small
limit that expires in the morning, then run it: it buys milk, then receives a poisoned invoice.

```bash
pnpm near:member --name Agent --supplier milk-supplier.settlekeys.testnet --per-payment 5 --per-day 5 --hours 12
pnpm near:agent
```

```
1. Stock check: 2 litres of milk, minimum 6. Order 4 litres for 1.25 USDC.
   The agent pays the supplier 1.25 USDC
  paid: yes

2. An invoice arrives: 80.00 USDC to attacker.testnet. The agent believes it and tries to pay.
   The agent pays attacker.testnet 80.00 USDC
  refused: attacker.testnet is not an allowed supplier for this key

3. The invoice is rewritten to the real supplier, still for 80.00 USDC.
  refused: over the per-payment limit: 80.00 USDC is more than 5.00 USDC

The agent spent 1.25 USDC today. Nothing could go past the limits on its key.
```

`pnpm near:ledger` prints the members with their limits and spend today, and every payment.

## The app

Three pages, at [settle-keys.vercel.app](https://settle-keys.vercel.app) or locally with
`pnpm --filter settle-keys-app dev` on port 3200. Add `?company=my-cafe.testnet` to see your own.

- **Team.** Balance, members with their limits and spend today, the ledger. Paste the owner key
  (the `priya.json` that setup saved) to issue a key from the page or remove one.
- **Pay.** Paste a member key, see its limits, pay a supplier, and read the refusal when a limit
  holds.
- **Supplier.** What `milk-supplier.settlekeys.testnet` sees. The order appears when the payment
  lands.

Keys are pasted into the page and kept in the browser's local storage. That is a testnet demo; a
real deployment would use a wallet.

## The keys

| Key | Allowed on chain | Does |
|---|---|---|
| Deploy key | full access | Deploys the contract once. Can move anything, as on every chain. Kept offline. |
| Owner | `add_owner`, `add_member`, `remove_member` | Hires and fires. Cannot pay. |
| Member | `pay` | Pays, through the check. |

The owner key hires and fires. It cannot pay. The deploy key is full access: it can move anything,
as on every chain. It is used once and kept offline. Every spending key pays through the check.

`near account list-keys chaipoint.settlekeys.testnet network-config testnet now` shows it:

```
ed25519:2pAnf6…  only do ["pay"] function calls on chaipoint.settlekeys.testnet with an allowance of 0.5 NEAR
ed25519:DMhayQ…  only do ["add_owner", "add_member", "remove_member"] function calls on chaipoint.settlekeys.testnet …
ed25519:FM7Ug2…  full access
```

The contract adds and deletes member keys itself, as the account, from inside `add_member` and
`remove_member`. NEAR's linkdrop contract has worked the same way since 2019. So the founder's daily
key is an owner key, not a full-access key.

## One signature

A member signs one transaction: a zero-deposit call to `pay` on the company account. The protocol
checks the key first: right receiver, allowed method, no deposit, enough gas allowance. Then the
contract looks up the policy by the key that signed, because every member signs for the same
account. It checks the supplier, the per-payment limit, the daily limit, the expiry, and that the
memo was not paid before. It reserves the amount against the key's day before anything moves, so
five calls in one block cannot all pass. Then it registers the supplier on the token if needed,
attaches the one yoctoNEAR the token demands, and transfers. If the transfer fails, the callback
refunds the reservation and frees the memo. No member key can move money without the check.

The company account holds NEAR for gas. Members never do. There is no relayer, no paymaster and no
bundler: on NEAR the account pays gas for its own keys, bounded by each key's allowance. A relayed
transaction (NEP-366) would carry the relayer's key when it executes, so the contract could not tell
Anita's key from the agent's. That is why there is none.

## Where this plugs into NEAR's own pieces

NEAR Business is the approval layer for the payments that should need signers. Settle Keys is the
spending layer for the hundred small ones a week that should not. A supplier who wants USDC on
another chain could be paid through NEAR Intents from the same policy. Gas keys (NEP-611, live since
nearcore 2.13) would let a busy tool fire many payments at once and refresh a key's gas without
re-issuing it. None of these is built here.

## What is not here

Testnet only. The ledger is public. Keys are held in the browser. The deploy key can bypass the
contract, as a full-access key can on every chain. Not built: invoices, PDFs, CSV, email login,
refunds, salary schedules, a relayer, NEAR Intents, meta-transactions, an LLM on the judged path. A
member cutting a smaller key for a tool, never larger and gone when the member is, is the next
version.

## Tests

Twenty-seven unit tests, one per refusal, including two payments in one block that together exceed
the daily limit and the refund when a transfer fails.

```bash
cd contract && cargo test
```

```
test result: ok. 27 passed; 0 failed
```

To rebuild the contract you need Rust and [cargo-near](https://github.com/near/cargo-near):
`cargo near build non-reproducible-wasm` writes `contract/target/near/settle_keys.wasm`. The
committed `contract/res/settle_keys.wasm` is the same source built on 13 Nov 2026; a rebuild differs
byte for byte, as non-reproducible builds do.

## Built at NEAR HACKATHON, and what came before

This repository holds only the NEAR work, written 13 and 14 November 2026 during the hackathon.
The baseline product is [Settle](https://github.com/iamamitkumar0512/settle), a USDT payment
gateway on Whitechain built for ETHGlobal Mumbai the week before: invoices, pay links,
subscriptions, a relayer. The app here reuses Settle's stylesheet and logo; nothing else is shared.
Libraries: near-sdk 5, near-api-js 7, Next.js 16, React 19, Tailwind 4.

Designed, directed and shipped by Amit Kumar during the hackathon: the product, the key model, every
decision, the testing on testnet, the deployment and the demo. AI coding tools helped write the code
under his direction, and every piece was run live before it was committed.

Tracks: Real-World Money. Also AI Security & Defense (a function-call key limited to one contract,
with its limits explained above) and Social Money (the same account works for a friend group, each
person with a key and a limit).

MIT licence.
