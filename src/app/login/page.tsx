import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const mode = sp.mode === "signup" ? "signup" : "signin";
  const next = typeof sp.next === "string" ? sp.next : "/app/in";
  const error = sp.error === "auth" ? "That sign-in link is invalid or expired." : undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm text-muted hover:underline">← Socializer</Link>
        <h1 className="mt-4 text-2xl font-semibold">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "signup"
            ? "Free forever for X. No card required."
            : "Sign in to open today's deck."}
        </p>
        {error && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        <div className="card mt-6">
          <LoginForm mode={mode} next={next} />
        </div>
      </div>
    </main>
  );
}
