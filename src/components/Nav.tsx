"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/app/in", label: "In", hint: "post candidates" },
  { href: "/app/out", label: "Out", hint: "posts" },
];

export function Nav({ email }: { email: string | null }) {
  const pathname = usePathname();
  const section = pathname.startsWith("/app/out") ? "out" : "in";
  const onSettings = pathname.startsWith(`/app/${section}/settings`);
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/app" className="font-semibold tracking-tight">Socializer</Link>
          <nav className="flex rounded-lg border border-border p-0.5">
            {tabs.map((t) => {
              const active = pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  title={t.hint}
                  className={`rounded-md px-4 py-1.5 text-sm ${active ? "bg-accent text-accent-foreground font-medium" : "text-muted hover:text-foreground"}`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <Link
            href={`/app/${section}/settings`}
            aria-label={`${section === "in" ? "In" : "Out"} settings`}
            title={section === "in" ? "Gather settings" : "Posting settings"}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border text-lg ${
              onSettings ? "bg-background" : "text-muted hover:text-foreground"
            }`}
          >
            ⚙
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/app/billing" className={`text-xs ${pathname.startsWith("/app/billing") ? "font-medium" : "text-muted hover:text-foreground"}`}>
            Billing
          </Link>
          <form action="/auth/signout" method="post" className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:inline">{email}</span>
            <button type="submit" className="btn-secondary !py-1 text-xs">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
