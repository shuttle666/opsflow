"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/ui/app-shell";
import { SectionCard } from "@/components/ui/section-card";
import { useAuthStore } from "@/store/auth-store";
import type { InvitationAcceptedResult } from "@/types/auth";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const acceptInvitation = useAuthStore((state) => state.acceptInvitation);
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InvitationAcceptedResult | null>(null);

  useEffect(() => {
    const tokenFromQuery = searchParams.get("token");
    if (tokenFromQuery) {
      setToken(tokenFromQuery);
    }
  }, [searchParams]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const accepted = await acceptInvitation(token.trim());
      setResult(accepted);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to accept invitation.";
      setError(message);
      setResult(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Accept tenant invitation"
      description="Use your invitation token to join a tenant workspace. You must be signed in with the invited email."
    >
      <AuthGuard>
        <div className="mx-auto grid w-full max-w-3xl gap-6">
          <SectionCard
            eyebrow="Invitation"
            title="Join workspace"
            description="Paste the invitation token or open this page from an invitation link that already includes it."
          >
            <form className="space-y-4" onSubmit={onSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Invitation token
                </span>
                <input
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  placeholder="Paste invitation token"
                  required
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {submitting ? "Accepting..." : "Accept invitation"}
              </button>
            </form>

            {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

            {result ? (
              <div className="mt-4 space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="font-semibold">Invitation accepted successfully.</p>
                <p>Tenant ID: {result.tenantId}</p>
                <p>Role: {result.role}</p>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="mt-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 font-medium text-emerald-700 transition hover:bg-emerald-100"
                >
                  Go to dashboard
                </button>
              </div>
            ) : null}
          </SectionCard>
        </div>
      </AuthGuard>
    </AppShell>
  );
}
