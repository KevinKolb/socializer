"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { KNOWN_PLATFORMS, type KnownPlatform } from "@/lib/plans";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function setPlatformEnabled(platform: "x", enabled: boolean): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase
    .from("platform_connections")
    .update({ enabled })
    .eq("user_id", user.id)
    .eq("platform", platform);
  revalidatePath("/app/out/settings");
}

const AccountInput = z.object({
  platform: z.enum(KNOWN_PLATFORMS as [KnownPlatform, ...KnownPlatform[]]),
  username: z.string().trim().max(100),
});

/** Save (or clear, when blank) the user's handle for a platform. */
export async function savePlatformAccount(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const parsed = AccountInput.safeParse({
    platform: formData.get("platform"),
    username: String(formData.get("username") ?? "").replace(/^@+/, ""),
  });
  if (!parsed.success) throw new Error("Invalid platform or username.");
  const { platform, username } = parsed.data;

  if (!username) {
    await supabase.from("platform_accounts").delete().eq("user_id", user.id).eq("platform", platform);
  } else {
    const { error } = await supabase
      .from("platform_accounts")
      .upsert({ user_id: user.id, platform, username }, { onConflict: "user_id,platform" });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/app/out/settings");
}
