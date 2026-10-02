import { createClient } from "@/lib/supabase/server";
import {
  PUBLIC_CONNECTION_COLUMNS,
  PUBLIC_POSTIZ_COLUMNS,
  type PlatformAccount,
  type PlatformConnectionPublic,
  type PostizChannel,
  type PostizSettingsPublic,
  type Profile,
  type Subscription,
} from "@/lib/types";
import { getEntitlement } from "@/lib/entitlements";
import { PageHeader } from "@/components/PageHeader";
import { PlatformsSection } from "./PlatformsSection";
import { PostizSection } from "./PostizSection";

export const dynamic = "force-dynamic";

export default async function OutSettingsPage({ searchParams }: PageProps<"/app/out/settings">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: connections },
    { data: profile },
    { data: sub },
    { data: accounts },
    { data: postiz },
    { data: channels },
  ] = await Promise.all([
    supabase
      .from("platform_connections")
      .select(PUBLIC_CONNECTION_COLUMNS)
      .eq("user_id", user!.id)
      .returns<PlatformConnectionPublic[]>(),
    supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
    supabase.from("subscriptions").select("*").eq("user_id", user!.id).maybeSingle<Subscription>(),
    supabase.from("platform_accounts").select("*").eq("user_id", user!.id).returns<PlatformAccount[]>(),
    supabase
      .from("postiz_settings")
      .select(PUBLIC_POSTIZ_COLUMNS)
      .eq("user_id", user!.id)
      .maybeSingle<PostizSettingsPublic>(),
    supabase
      .from("postiz_channels")
      .select("*")
      .eq("user_id", user!.id)
      .order("identifier")
      .returns<PostizChannel[]>(),
  ]);

  const entitlement = profile ? getEntitlement(profile, sub ?? null) : null;
  const planName = entitlement?.plan.name ?? "Free";
  const planAllPlatforms = entitlement?.plan.allPlatforms ?? false;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Out · settings"
        subtitle="Where approved candidates get posted."
        back={{ href: "/app/out", label: "Back to Out" }}
      />
      <PostizSection
        settings={postiz ?? null}
        channels={channels ?? []}
        planName={planName}
        planAllPlatforms={planAllPlatforms}
      />
      <PlatformsSection
        connections={connections ?? []}
        accounts={accounts ?? []}
        channels={channels ?? []}
        notice={typeof sp.x === "string" ? sp.x : null}
        planName={planName}
      />
    </div>
  );
}
