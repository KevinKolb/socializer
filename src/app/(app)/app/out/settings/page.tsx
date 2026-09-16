import { createClient } from "@/lib/supabase/server";
import { PUBLIC_CONNECTION_COLUMNS, type PlatformAccount, type PlatformConnectionPublic, type Profile, type Subscription } from "@/lib/types";
import { getEntitlement } from "@/lib/entitlements";
import { PageHeader } from "@/components/PageHeader";
import { PlatformsSection } from "./PlatformsSection";

export const dynamic = "force-dynamic";

export default async function OutSettingsPage({ searchParams }: PageProps<"/app/out/settings">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: connections }, { data: profile }, { data: sub }, { data: accounts }] = await Promise.all([
    supabase
      .from("platform_connections")
      .select(PUBLIC_CONNECTION_COLUMNS)
      .eq("user_id", user!.id)
      .returns<PlatformConnectionPublic[]>(),
    supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
    supabase.from("subscriptions").select("*").eq("user_id", user!.id).maybeSingle<Subscription>(),
    supabase.from("platform_accounts").select("*").eq("user_id", user!.id).returns<PlatformAccount[]>(),
  ]);
  const planName = profile ? getEntitlement(profile, sub ?? null).plan.name : "Free";

  return (
    <div className="space-y-10">
      <PageHeader
        title="Out · settings"
        subtitle="Where approved candidates get posted."
        back={{ href: "/app/out", label: "Back to Out" }}
      />
      <PlatformsSection connections={connections ?? []} accounts={accounts ?? []} notice={typeof sp.x === "string" ? sp.x : null} planName={planName} />
    </div>
  );
}
