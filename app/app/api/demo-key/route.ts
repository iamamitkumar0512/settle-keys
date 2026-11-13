// POST /api/demo-key: issue a fresh member key on the demo company and hand it over.
// Every run gets its own key with an unused limit, so a second judge never meets a spent one.

import { DEMO_COMPANY, DEMO_POLICY, DEMO_SUPPLIER, allow, asOwner, nanosFromNow, newMemberKey, view } from "@/lib/demo";

export const maxDuration = 30;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allow(ip)) {
    return Response.json({ error: "too many demo keys from this address in the last hour; make your own company with pnpm near:setup" }, { status: 429 });
  }
  const key = newMemberKey();
  const name = `Demo ${key.public_key.slice(8, 14)}`;
  const expires_at = nanosFromNow(DEMO_POLICY.hours);
  const policy = { suppliers: [DEMO_SUPPLIER], per_payment: DEMO_POLICY.per_payment, per_day: DEMO_POLICY.per_day, expires_at };
  try {
    const [token, tx] = await Promise.all([
      view<string>(DEMO_COMPANY, "get_usdc"),
      asOwner("add_member", { key: key.public_key, name, policy }),
    ]);
    return Response.json({
      company: DEMO_COMPANY,
      token,
      supplier: DEMO_SUPPLIER,
      member: { name, ...key },
      policy: { per_payment: policy.per_payment, per_day: policy.per_day, expires_at },
      issued_tx: tx,
    });
  } catch (err: any) {
    return Response.json({ error: err?.message ?? "could not issue a demo key" }, { status: 502 });
  }
}
