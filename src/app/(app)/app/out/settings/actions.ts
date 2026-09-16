"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setPlatformEnabled(platform: "x", enabled: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase
    .from("platform_connections")
    .update({ enabled })
    .eq("user_id", user.id)
    .eq("platform", platform);
  revalidatePath("/app/out/settings");
}
