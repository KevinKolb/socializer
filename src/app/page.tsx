import Link from "next/link";
import { getUser } from "@/lib/supabase/server";

export default async function LandingPage() {
  const user = await getUser();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <span className="text-lg font-semibold tracking-tight">Socializer</span>
        <nav className="flex gap-3">
          {user ? (
            <Link href="/app/in" className="btn-primary">Open app</Link>
          ) : (
            <>
              <Link href="/login" className="btn-secondary">Sign in</Link>
              <Link href="/login?mode=signup" className="btn-primary">Start free</Link>
            </>
          )}
        </nav>
      </header>

      <section className="grid flex-1 items-center gap-12 py-16 md:grid-cols-2">
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            AI finds it. <br /> You swipe. <br /> It gets posted.
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted">
            Tell Socializer what you care about. Every day it gathers fresh, relevant
            content from the web and social platforms and drafts a post in your voice.
            Swipe right to publish, swipe left to skip.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href={user ? "/app/in" : "/login?mode=signup"} className="btn-primary">
              {user ? "Go to your deck" : "Start free with X"}
            </Link>
            <a href="#how" className="btn-secondary">How it works</a>
          </div>
        </div>

        <div className="card rotate-2 space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted">Example card</p>
          <h3 className="text-lg font-semibold">Open-source LLM beats closed models on coding benchmark</h3>
          <p className="text-sm text-muted">
            A new open-weights model matched frontier results on SWE-bench Verified, and it
            runs on a single consumer GPU.
          </p>
          <div className="rounded-xl bg-background p-3 text-sm">
            Open weights just caught up on real-world coding. If you build with LLMs, your
            cost curve just changed. Worth a read.
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>← Skip</span>
            <span>Post →</span>
          </div>
        </div>
      </section>

      <section id="how" className="grid gap-6 py-16 md:grid-cols-3">
        {[
          ["In", "Every morning an AI researcher searches the web and social sites for your interests and drafts post candidates in your voice."],
          ["Swipe", "Open the In deck once a day. Swipe right to post, left to skip. Edit a draft first if you like."],
          ["Out", "Approved candidates go straight out to X. Facebook, Instagram, Threads, LinkedIn, Bluesky and more are on the way."],
        ].map(([title, body]) => (
          <div key={title} className="card">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted">{body}</p>
          </div>
        ))}
      </section>

      <footer className="py-8 text-center text-xs text-muted">
        © {new Date().getFullYear()} Socializer
      </footer>
    </main>
  );
}
