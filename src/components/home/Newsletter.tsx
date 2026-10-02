"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  return (
    <section className="mx-auto max-w-7xl px-4 py-14">
      <div className="overflow-hidden rounded-2xl bg-foreground px-6 py-12 text-background sm:px-12">
        <div className="mx-auto max-w-xl text-center">
          <Mail size={28} className="mx-auto text-accent" />
          <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Get 10% off your first order</h2>
          <p className="mt-2 text-background/70">
            Join the list for early access to drops, deals, and design stories.
          </p>
          {done ? (
            <p className="mt-6 font-medium text-success">Thanks — check your inbox! (demo)</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) setDone(true);
              }}
              className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 rounded-full bg-background px-5 py-3 text-sm text-foreground outline-none"
              />
              <button
                type="submit"
                className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90"
              >
                Subscribe
              </button>
            </form>
          )}
          <p className="mt-3 text-xs text-background/50">
            No spam. Unsubscribe anytime. (This is a demo — no email is stored.)
          </p>
        </div>
      </div>
    </section>
  );
}
