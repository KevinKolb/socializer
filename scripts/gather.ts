/**
 * Standalone gather runner. Used by the GitHub Actions workflow
 * (.github/workflows/gather.yml) and handy for local testing.
 *
 *   npx tsx scripts/gather.ts            # every user with an active interest
 *   npx tsx scripts/gather.ts <user-id>  # one user (what "Gather now" triggers)
 *
 * Locally: node --env-file=.env.local node_modules/.bin/tsx scripts/gather.ts
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { gatherForUser } from "@/lib/gather";

async function main() {
  const onlyUser = process.argv[2]?.trim() || null;
  const admin = createAdminClient();

  let userIds: string[];
  if (onlyUser) {
    userIds = [onlyUser];
  } else {
    const { data, error } = await admin.from("interests").select("user_id").eq("active", true);
    if (error) throw new Error(error.message);
    userIds = [...new Set((data ?? []).map((r) => r.user_id as string))];
  }

  console.log(`Gathering for ${userIds.length} user(s)…`);
  const trigger = onlyUser ? "manual" : "cron";
  const CONCURRENCY = 3;
  let created = 0;
  let failures = 0;

  for (let i = 0; i < userIds.length; i += CONCURRENCY) {
    const chunk = userIds.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.all(chunk.map((id) => gatherForUser(admin, id, trigger)));
    for (const o of outcomes) {
      created += o.created;
      if (o.error) failures++;
      console.log(
        `${o.userId}: ${o.error ? `ERROR ${o.error}` : o.skipped ? `skipped (${o.skipped})` : `${o.created} new`}`,
      );
    }
  }

  console.log(`Done. ${created} item(s) created, ${failures} failure(s).`);
  if (failures > 0 && failures === userIds.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
