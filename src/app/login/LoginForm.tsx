"use client";

import Link from "next/link";
import { useActionState } from "react";
import { sendMagicLink, signIn, signUp, type AuthState } from "./actions";

const initial: AuthState = {};

export function LoginForm({ mode, next }: { mode: "signin" | "signup"; next: string }) {
  const [state, action, pending] = useActionState(mode === "signup" ? signUp : signIn, initial);
  const [magicState, magicAction, magicPending] = useActionState(sendMagicLink, initial);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="input"
          />
        </div>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {state.message && <p className="text-sm text-success">{state.message}</p>}
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      <form action={magicAction} className="border-t border-border pt-4">
        <input type="hidden" name="next" value={next} />
        <p className="mb-2 text-xs text-muted">Prefer no password? Enter your email above and:</p>
        <MagicButton pending={magicPending} />
        {magicState.error && <p className="mt-2 text-sm text-danger">{magicState.error}</p>}
        {magicState.message && <p className="mt-2 text-sm text-success">{magicState.message}</p>}
      </form>

      <p className="text-center text-sm text-muted">
        {mode === "signup" ? (
          <>Already have an account? <Link className="underline" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></>
        ) : (
          <>New here? <Link className="underline" href={`/login?mode=signup&next=${encodeURIComponent(next)}`}>Create an account</Link></>
        )}
      </p>
    </div>
  );
}

/** Submits the magic-link form using the email typed into the main form. */
function MagicButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-secondary w-full"
      onClick={(e) => {
        const email = (document.getElementById("email") as HTMLInputElement | null)?.value ?? "";
        const form = e.currentTarget.form;
        if (!form) return;
        let hidden = form.querySelector<HTMLInputElement>('input[name="email"]');
        if (!hidden) {
          hidden = document.createElement("input");
          hidden.type = "hidden";
          hidden.name = "email";
          form.appendChild(hidden);
        }
        hidden.value = email;
      }}
    >
      {pending ? "Sending…" : "Email me a magic link"}
    </button>
  );
}
