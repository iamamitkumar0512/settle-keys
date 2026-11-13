// What the company has: its members with their limits and spend today, and every payment.
//
//   pnpm near:ledger

import { COMPANY, accountUrl, fmtUsdc } from "./lib/config.js";
import { view } from "./lib/chain.js";

interface MemberView {
  key: string;
  name: string;
  role: "Owner" | "Member";
  root: boolean;
  policy: { suppliers: string[]; per_payment: string; per_day: string; expires_at: string | null } | null;
  spent_today: string;
}
interface Entry {
  id: number;
  member: string;
  to: string;
  amount: string;
  memo: string;
  status: "Pending" | "Paid" | "Failed";
}

const usdc = await view<string>(COMPANY, "get_usdc");
const members = await view<MemberView[]>(COMPANY, "get_members");
const ledger = await view<Entry[]>(COMPANY, "get_ledger", { from: 0, limit: 100 });

console.log(`Company ${COMPANY}  (${accountUrl(COMPANY)})`);
console.log(`Pays with ${usdc}\n`);
console.log("Members");
for (const m of members) {
  const what = m.root
    ? "deploy key, full access"
    : m.role === "Owner"
      ? "owner: can add and remove members, cannot pay"
      : `member: ${m.policy!.suppliers.join(", ")}, ${fmtUsdc(m.policy!.per_payment)} a payment, ${fmtUsdc(m.policy!.per_day)} a day` +
        (m.policy!.expires_at ? `, until ${new Date(Number(BigInt(m.policy!.expires_at) / 1_000_000n)).toISOString()}` : "") +
        `, spent today ${fmtUsdc(m.spent_today)}`;
  console.log(`  ${m.name.padEnd(12)} ${what}`);
  console.log(`  ${"".padEnd(12)} ${m.key}`);
}
console.log("\nLedger");
if (ledger.length === 0) console.log("  (no payments yet)");
for (const e of ledger) {
  console.log(`  #${e.id} ${e.status.padEnd(7)} ${e.member.padEnd(10)} ${fmtUsdc(e.amount).padStart(14)} -> ${e.to}  memo ${e.memo}`);
}
