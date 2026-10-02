"use client";

import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";

export interface MessageView {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
}

const inputClass =
  "w-full rounded-lg border bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent";

export function MessageCenter({ initial }: { initial: MessageView[] }) {
  const [messages, setMessages] = useState<MessageView[]>(initial);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSent(false);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send message.");
      setMessages((m) => [data.message, ...m]);
      setSubject("");
      setBody("");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <form onSubmit={send} className="rounded-2xl border p-5">
        <h2 className="font-semibold">Send us a message</h2>
        <div className="mt-4 flex flex-col gap-3">
          <input
            className={inputClass}
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            className={`${inputClass} min-h-28 resize-y`}
            placeholder="How can we help?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        {sent && <p className="mt-3 text-sm text-success">Message sent — we&apos;ll get back to you soon.</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-4 flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Send message
        </button>
      </form>

      {messages.length > 0 && (
        <div>
          <h2 className="mb-3 font-semibold">Your messages</h2>
          <ul className="flex flex-col gap-3">
            {messages.map((m) => (
              <li key={m.id} className="rounded-2xl border p-4">
                <div className="flex items-center gap-2">
                  <MessageCircle size={16} className="text-accent" />
                  <p className="font-medium">{m.subject}</p>
                  <span className="ml-auto text-xs text-muted">
                    {new Date(m.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">{m.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
