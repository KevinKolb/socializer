import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/entitlements";
import type { Profile, Subscription } from "@/lib/types";
import Link from "next/link";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/in");

  const [{ data: profile }, { data: sub }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>(),
    supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle<Subscription>(),
  ]);

  const entitlement = profile ? getEntitlement(profile, sub ?? null) : null;

  return (
    <>
      <Nav email={user.email ?? null} />
      {entitlement && entitlement.plan.id === "free" && (
        <div className="bg-accent/10 px-6 py-2 text-center text-xs">
          Free plan: posts to X, up to {entitlement.plan.maxDailyCards} candidates a day.{" "}
          <Link href="/app/billing" className="underline">Upgrade to Pro</Link> for more platforms and a bigger deck.
        </div>
      )}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </>
  );
}
