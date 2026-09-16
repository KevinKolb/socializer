"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ALL_SOURCES } from "@/lib/sources";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

const InterestInput = z.object({
  topic: z.string().trim().min(2).max(120),
  guidance: z.string().trim().max(500).optional(),
  sources: z.array(z.enum(ALL_SOURCES)).min(1),
});

export async function addInterest(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const parsed = InterestInput.safeParse({
    topic: formData.get("topic"),
    guidance: formData.get("guidance") || undefined,
    sources: formData.getAll("sources"),
  });
  if (!parsed.success) throw new Error("Please enter a topic and pick at least one source.");

  const { error } = await supabase.from("interests").insert({
    user_id: user.id,
    topic: parsed.data.topic,
    guidance: parsed.data.guidance ?? null,
    sources: parsed.data.sources,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/in/settings");
}

export async function toggleInterest(id: string, active: boolean): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase.from("interests").update({ active }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/app/in/settings");
}

export async function deleteInterest(id: string): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase.from("interests").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/app/in/settings");
}

const ProfileInput = z.object({
  display_name: z.string().trim().max(80).optional(),
  voice: z.string().trim().min(3).max(400),
  daily_item_target: z.coerce.number().int().min(3).max(40),
  timezone: z.string().trim().max(64),
});

export async function updateProfile(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const parsed = ProfileInput.safeParse({
    display_name: formData.get("display_name") || undefined,
    voice: formData.get("voice"),
    daily_item_target: formData.get("daily_item_target"),
    timezone: formData.get("timezone") || "UTC",
  });
  if (!parsed.success) throw new Error("Invalid profile values.");

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.display_name ?? null,
      voice: parsed.data.voice,
      daily_item_target: parsed.data.daily_item_target,
      timezone: parsed.data.timezone,
    })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/app/in/settings");
}
