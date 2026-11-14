// GET /api/cron/cleanup: remove demo keys that have expired. Vercel calls it once a day (the free
// plan's limit) with the CRON_SECRET; anyone else gets 401. Expired keys cannot pay anyway: the
// contract refuses them. This only tidies the member list.

import { DEMO_COMPANY, asOwner, view } from "@/lib/demo";

export const maxDuration = 60;

interface MemberView {
  key: string;
  name: string;
  role: "Owner" | "Member";
  policy: { expires_at: string | null } | null;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const now = BigInt(Date.now()) * 1_000_000n;
  const members = await view<MemberView[]>(DEMO_COMPANY, "get_members");
  const expired = members.filter(
    (m) => m.role === "Member" && m.name.startsWith("Demo ") && m.policy?.expires_at && BigInt(m.policy.expires_at) < now,
  );
  const removed: string[] = [];
  const failed: { key: string; error: string }[] = [];
  for (const m of expired) {
    try {
      await asOwner("remove_member", { key: m.key });
      removed.push(m.key);
    } catch (err: any) {
      failed.push({ key: m.key, error: err?.message ?? String(err) });
    }
  }
  return Response.json({ company: DEMO_COMPANY, checked: members.length, removed, failed });
}
