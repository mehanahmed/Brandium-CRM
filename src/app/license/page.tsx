"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Check, Globe, KeyRound, Loader2, RefreshCw } from "lucide-react";

type LicenseInfo = {
  host: string;
  activated: boolean;
  dev: boolean;
  client: string | null;
  expiresAt: string | null;
  error: string | null;
};

const formatExpiry = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "Never (lifetime)";

export default function LicensePage() {
  const router = useRouter();
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [key, setKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [changing, setChanging] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    const res = await fetch("/api/license", { cache: "no-store" });
    setInfo((await res.json()) as LicenseInfo);
  };

  useEffect(() => {
    void load().catch(() => setMessage({ ok: false, text: "Could not check the license." }));
  }, []);

  const activate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!key.trim() || submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim() }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
      } & Partial<LicenseInfo>;
      if (!json.success) {
        setMessage({ ok: false, text: json.error || "Activation failed." });
        return;
      }
      setKey("");
      setChanging(false);
      setMessage({ ok: true, text: `Brandium CRM is activated for ${json.host}.` });
      await load();
    } catch {
      setMessage({ ok: false, text: "Activation failed. Check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const activated = info?.activated && !changing;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 text-slate-800">
      <div className="flex w-full max-w-xl flex-col items-center text-center">
        {!info ? (
          <div className="flex flex-col items-center py-20 text-slate-500">
            <Loader2 className="mb-3 size-8 animate-spin text-[#67B239]" />
            <p className="text-sm">Checking license…</p>
          </div>
        ) : activated ? (
          <>
            <div className="grid size-12 place-items-center rounded-full bg-[#67B239]/15 text-[#55962e]">
              <Check className="size-6" strokeWidth={2.5} />
            </div>
            <p className="mt-3 text-sm text-slate-500">Licensed system</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0a2e5c] sm:text-3xl">
              Brandium CRM is activated
            </h1>

            <div className="mt-7 w-full space-y-4 rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="text-xs text-slate-400">Authorized domain</div>
                  <div className="font-mono text-sm font-semibold">{info.host}</div>
                </div>
                <span className="rounded-full border border-[#67B239]/40 bg-[#67B239]/10 px-3 py-1 text-xs font-semibold text-[#55962e]">
                  {info.dev ? "Development" : "Active"}
                </span>
              </div>
              {!info.dev && (
                <dl className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <dt className="text-slate-400">Licensed to</dt>
                    <dd className="font-semibold">{info.client}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Expires</dt>
                    <dd className="font-semibold">{formatExpiry(info.expiresAt)}</dd>
                  </div>
                </dl>
              )}
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#67B239] text-sm font-medium text-white transition hover:bg-[#5aa030]"
              >
                Continue to sign in <ArrowRight className="size-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setChanging(true);
                setMessage(null);
              }}
              className="mt-6 flex cursor-pointer items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
            >
              <RefreshCw className="size-3" /> Enter a different license key
            </button>
          </>
        ) : (
          <>
            <div className="grid size-12 place-items-center rounded-full bg-[#0a2e5c]/10 text-[#0a2e5c]">
              <KeyRound className="size-6" />
            </div>
            <p className="mt-3 text-sm text-slate-500">Activation required</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0a2e5c] sm:text-3xl">
              Enter the license key
            </h1>

            <form onSubmit={activate} className="mt-7 w-full">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition focus-within:border-[#67B239] focus-within:shadow-md sm:p-5">
                <label htmlFor="license-key" className="sr-only">
                  License key
                </label>
                <textarea
                  id="license-key"
                  rows={3}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void activate();
                    }
                  }}
                  placeholder="BRLIC-…"
                  className="w-full resize-none bg-transparent font-mono text-sm leading-relaxed outline-none placeholder:text-slate-400"
                />
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
                    <Globe className="size-3.5 shrink-0" /> Host:
                    <span className="truncate font-mono font-medium text-slate-600">
                      {info.host}
                    </span>
                  </span>
                  <button
                    type="submit"
                    disabled={submitting || !key.trim()}
                    aria-label="Activate license"
                    className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-[#67B239] text-white transition hover:bg-[#5aa030] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowRight className="size-4" />
                    )}
                  </button>
                </div>
              </div>
            </form>

            {!message && info.error && !changing && (
              <p className="mt-4 text-xs text-slate-500">{info.error}</p>
            )}
            {changing && (
              <button
                type="button"
                onClick={() => setChanging(false)}
                className="mt-4 cursor-pointer text-xs text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            )}
          </>
        )}

        {message && (
          <div
            role="status"
            className={`mt-4 flex w-full items-center gap-2.5 rounded-2xl border p-3.5 text-left text-xs ${
              message.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {message.ok ? (
              <Check className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <p className="mt-12 text-xs text-slate-400">
          Brandium Agency © {new Date().getFullYear()} · License activation
        </p>
      </div>
    </main>
  );
}
