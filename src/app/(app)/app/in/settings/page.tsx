import { createClient } from "@/lib/supabase/server";
import type { Interest, Profile, Subscription } from "@/lib/types";
import { getEntitlement } from "@/lib/entitlements";
import { PageHeader } from "@/components/PageHeader";
import { InterestsSection } from "./InterestsSection";
import { ProfileSection } from "./ProfileSection";

export const dynamic = "force-dynamic";

export default async function InSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: interests }, { data: sub }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
    supabase.from("interests").select("*").eq("user_id", user!.id).order("created_at").returns<Interest[]>(),
    supabase.from("subscriptions").select("*").eq("user_id", user!.id).maybeSingle<Subscription>(),
  ]);
  const entitlement = profile ? getEntitlement(profile, sub ?? null) : null;

  return (
    <div className="space-y-10">
      <PageHeader
        title="In · settings"
        subtitle="What the AI gathers for you, how the drafts sound, and how many arrive each day."
        back={{ href: "/app/in", label: "Back to In" }}
      />
      <InterestsSection interests={interests ?? []} />
      {profile && entitlement && <ProfileSection profile={profile} maxCards={entitlement.plan.maxDailyCards} planName={entitlement.plan.name} />}
    </div>
  );
}
