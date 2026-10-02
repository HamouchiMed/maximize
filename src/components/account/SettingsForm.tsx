"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";

const inputClass =
  "w-full rounded-lg border bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent";

const COUNTRIES = [
  "Morocco", "Algeria", "Tunisia", "Egypt", "France", "Spain", "Italy",
  "Germany", "United Kingdom", "Netherlands", "Belgium", "United States",
  "Canada", "United Arab Emirates", "Saudi Arabia", "Qatar", "Senegal",
  "Ivory Coast", "Mauritania", "Turkey", "Other",
];

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <span className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span>;
}

export function SettingsForm({
  email,
  initialName,
  initialImage,
  initialCountry,
  hasPassword,
}: {
  email: string;
  initialName: string;
  initialImage?: string | null;
  initialCountry: string;
  hasPassword: boolean;
}) {
  const { user, setUser } = useAuth();
  const router = useRouter();

  const [image, setImage] = useState<string | null>(initialImage ?? null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingName, setSavingName] = useState(false);

  const [country, setCountry] = useState(initialCountry);
  const [countryMsg, setCountryMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [emailPw, setEmailPw] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingEmail, setSavingEmail] = useState(false);
  const [currentEmail, setCurrentEmail] = useState(email);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      alert("Please choose an image under 1.5 MB.");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const res = await fetch("/api/account/avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl }),
        });
        const data = await res.json();
        if (res.ok) {
          setImage(data.image);
          if (user) setUser({ ...user, image: data.image });
        }
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    setNameMsg(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      if (user) setUser({ ...user, name: data.user.name });
      setNameMsg({ ok: true, text: "Saved" });
    } catch (err) {
      setNameMsg({ ok: false, text: err instanceof Error ? err.message : "Error" });
    } finally {
      setSavingName(false);
    }
  }

  async function saveCountry(value: string) {
    setCountry(value);
    setCountryMsg(null);
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: value }),
    });
    setCountryMsg(res.ok ? { ok: true, text: "Saved" } : { ok: false, text: "Could not save" });
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setSavingEmail(true);
    setEmailMsg(null);
    try {
      const res = await fetch("/api/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail, password: emailPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not change email.");
      setCurrentEmail(data.email);
      if (user) setUser({ ...user, email: data.email });
      setNewEmail("");
      setEmailPw("");
      setEmailMsg({ ok: true, text: "Email updated" });
    } catch (err) {
      setEmailMsg({ ok: false, text: err instanceof Error ? err.message : "Error" });
    } finally {
      setSavingEmail(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPw(true);
    setPwMsg(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update password.");
      setCurrent("");
      setNext("");
      setPwMsg({ ok: true, text: "Password updated" });
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : "Error" });
    } finally {
      setSavingPw(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteMsg(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete account.");
      setUser(null);
      router.push("/");
      router.refresh();
    } catch (err) {
      setDeleteMsg(err instanceof Error ? err.message : "Error");
      setDeleting(false);
    }
  }

  const initial = (name || currentEmail).charAt(0).toUpperCase();

  return (
    <div className="mt-8 flex flex-col gap-10">
      {/* ---- Personal information ---- */}
      <section>
        <h2 className="text-lg font-semibold">Personal information</h2>
        <div className="mt-4 flex flex-col gap-5">
          {/* Avatar */}
          <div className="flex items-center gap-4 rounded-2xl border p-5">
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-accent/15">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-accent">
                  {initial}
                </span>
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium">Profile picture</p>
              <p className="text-sm text-muted">JPG or PNG, up to 1.5 MB.</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium hover:bg-surface disabled:opacity-60"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              Upload picture
            </button>
          </div>

          {/* Edit profile */}
          <form onSubmit={saveName} className="rounded-2xl border p-5">
            <h3 className="font-medium">Edit profile</h3>
            <label className="mt-3 block text-sm text-muted">Name</label>
            <input
              className={`${inputClass} mt-1`}
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="mt-4 flex items-center gap-3">
              <button
                type="submit"
                disabled={savingName}
                className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
              >
                {savingName && <Loader2 size={16} className="animate-spin" />}
                Save
              </button>
              <Msg msg={nameMsg} />
            </div>
          </form>

          {/* Country */}
          <div className="rounded-2xl border p-5">
            <h3 className="font-medium">Country / region</h3>
            <div className="mt-3 flex items-center gap-3">
              <select
                className={`${inputClass} max-w-xs`}
                value={country}
                onChange={(e) => saveCountry(e.target.value)}
              >
                <option value="">Select a country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Msg msg={countryMsg} />
            </div>
          </div>

          {/* Delete account */}
          <div className="rounded-2xl border border-danger/40 p-5">
            <h3 className="flex items-center gap-2 font-medium text-danger">
              <AlertTriangle size={17} /> Delete account
            </h3>
            <p className="mt-1 text-sm text-muted">
              This permanently removes your account and data. This can&apos;t be undone.
            </p>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="mt-4 rounded-full border border-danger px-5 py-2.5 text-sm font-semibold text-danger hover:bg-danger hover:text-white"
              >
                Delete account
              </button>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {hasPassword && (
                  <input
                    type="password"
                    className={`${inputClass} max-w-xs`}
                    placeholder="Enter your password to confirm"
                    value={deletePw}
                    onChange={(e) => setDeletePw(e.target.value)}
                  />
                )}
                {deleteMsg && <p className="text-sm text-danger">{deleteMsg}</p>}
                <div className="flex items-center gap-3">
                  <button
                    onClick={deleteAccount}
                    disabled={deleting}
                    className="flex items-center gap-2 rounded-full bg-danger px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {deleting && <Loader2 size={16} className="animate-spin" />}
                    Yes, delete my account
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-sm text-muted hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---- Security information ---- */}
      <section>
        <h2 className="text-lg font-semibold">Security information</h2>
        <div className="mt-4 flex flex-col gap-5">
          {/* Change email */}
          <form onSubmit={changeEmail} className="rounded-2xl border p-5">
            <h3 className="font-medium">Change email address</h3>
            <p className="mt-1 text-sm text-muted">Current: {currentEmail}</p>
            <div className="mt-3 flex flex-col gap-3">
              <input
                type="email"
                className={inputClass}
                placeholder="New email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              {hasPassword && (
                <input
                  type="password"
                  className={inputClass}
                  placeholder="Your current password"
                  autoComplete="current-password"
                  value={emailPw}
                  onChange={(e) => setEmailPw(e.target.value)}
                />
              )}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="submit"
                disabled={savingEmail}
                className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
              >
                {savingEmail && <Loader2 size={16} className="animate-spin" />}
                Update email
              </button>
              <Msg msg={emailMsg} />
            </div>
          </form>

          {/* Change password */}
          <form onSubmit={changePassword} className="rounded-2xl border p-5">
            <h3 className="font-medium">{hasPassword ? "Change password" : "Set a password"}</h3>
            <div className="mt-3 flex flex-col gap-3">
              {hasPassword && (
                <input
                  type="password"
                  className={inputClass}
                  placeholder="Current password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
              )}
              <input
                type="password"
                className={inputClass}
                placeholder="New password (min. 8 characters)"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="submit"
                disabled={savingPw}
                className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
              >
                {savingPw && <Loader2 size={16} className="animate-spin" />}
                {hasPassword ? "Update password" : "Set password"}
              </button>
              <Msg msg={pwMsg} />
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
