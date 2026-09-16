import type { Interest } from "@/lib/types";
import { ALL_SOURCES, SOURCE_LABELS } from "@/lib/sources";
import { addInterest, deleteInterest, toggleInterest } from "./actions";

export function InterestsSection({ interests }: { interests: Interest[] }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Interests</h2>
        <p className="text-sm text-muted">
          The AI searches for fresh items on each active topic every morning.
        </p>
      </div>

      <ul className="space-y-2">
        {interests.length === 0 && (
          <li className="text-sm text-muted">No interests yet. Add your first one below.</li>
        )}
        {interests.map((i) => (
          <li key={i.id} className="card flex flex-wrap items-center gap-3 !py-3">
            <div className="min-w-0 flex-1">
              <p className={`font-medium ${i.active ? "" : "text-muted line-through"}`}>{i.topic}</p>
              {i.guidance && <p className="text-xs text-muted">{i.guidance}</p>}
              <p className="mt-1 text-xs text-muted">
                {i.sources.map((s) => SOURCE_LABELS[s as keyof typeof SOURCE_LABELS] ?? s).join(" · ")}
              </p>
            </div>
            <form action={toggleInterest.bind(null, i.id, !i.active)}>
              <button className="btn-secondary !py-1 text-xs">{i.active ? "Pause" : "Resume"}</button>
            </form>
            <form action={deleteInterest.bind(null, i.id)}>
              <button className="btn-danger !py-1 text-xs">Delete</button>
            </form>
          </li>
        ))}
      </ul>

      <form action={addInterest} className="card space-y-3">
        <div>
          <label className="label" htmlFor="topic">New topic</label>
          <input id="topic" name="topic" className="input" placeholder="e.g. AI agents for developers" required />
        </div>
        <div>
          <label className="label" htmlFor="guidance">Guidance (optional)</label>
          <input
            id="guidance"
            name="guidance"
            className="input"
            placeholder="e.g. Practical tips only, skip funding news and politics"
          />
        </div>
        <div>
          <p className="label">Sources</p>
          <div className="flex flex-wrap gap-3">
            {ALL_SOURCES.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="sources"
                  value={s}
                  defaultChecked={["news", "blogs", "x"].includes(s)}
                />
                {SOURCE_LABELS[s]}
              </label>
            ))}
          </div>
        </div>
        <button className="btn-primary">Add interest</button>
      </form>
    </section>
  );
}
