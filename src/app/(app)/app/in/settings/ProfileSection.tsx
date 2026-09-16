import type { Profile } from "@/lib/types";
import { updateProfile } from "./actions";

export function ProfileSection({ profile, maxCards, planName }: { profile: Profile; maxCards: number; planName: string }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Voice & volume</h2>
        <p className="text-sm text-muted">How your drafts should sound and how many cards to prepare each day.</p>
      </div>
      <form action={updateProfile} className="card space-y-3">
        <div>
          <label className="label" htmlFor="display_name">Display name</label>
          <input id="display_name" name="display_name" className="input" defaultValue={profile.display_name ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="voice">Posting voice</label>
          <textarea id="voice" name="voice" className="input min-h-20" defaultValue={profile.voice} required />
          <p className="mt-1 text-xs text-muted">
            Example: &quot;Friendly, opinionated, first person, no emojis. I&apos;m a founder talking to other founders.&quot;
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="daily_item_target">Cards per day</label>
            <input
              id="daily_item_target"
              name="daily_item_target"
              type="number"
              min={3}
              max={maxCards}
              className="input"
              defaultValue={Math.min(profile.daily_item_target, maxCards)}
            />
            <p className="mt-1 text-xs text-muted">{planName} plan allows up to {maxCards}.</p>
          </div>
          <div>
            <label className="label" htmlFor="timezone">Timezone</label>
            <input id="timezone" name="timezone" className="input" defaultValue={profile.timezone} placeholder="America/Chicago" />
          </div>
        </div>
        <button className="btn-primary">Save</button>
      </form>
    </section>
  );
}
