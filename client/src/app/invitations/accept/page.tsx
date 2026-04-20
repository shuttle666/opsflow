"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { PublicShell } from "@/components/ui/app-shell";
import { ArrowRight } from "@/components/ui/icons";
import {
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  strongSurfaceClassName,
} from "@/components/ui/styles";
import { useAuthStore } from "@/store/auth-store";
import type { InvitationAcceptedResult } from "@/types/auth";

function AcceptInvitationPageContent() {
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
    <PublicShell>
      <AuthGuard>
        <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center py-6">
          <section className={`${strongSurfaceClassName} w-full max-w-[28rem] p-8 sm:p-10`}>
            <div className="space-y-3 text-center">
              <p className="text-xs font-semibold uppercase text-[var(--color-brand)]">
                Invitation
              </p>
              <h1 className="text-3xl font-semibold text-[var(--color-text)]">
                Accept workspace invite
              </h1>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                Use this compatibility page when you arrive from a legacy invite link.
              </p>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <label className="mt-8 block space-y-2">
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">Invitation token</span>
                <input
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  className={`${inputClassName} mt-1`}
                  placeholder="Paste invitation token"
                  required
                />
              </label>

              <button type="submit" disabled={submitting} className={primaryButtonClassName}>
                {submitting ? "Accepting..." : "Accept invitation"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {error ? <p className="mt-4 text-sm text-center text-rose-600">{error}</p> : null}

            {result ? (
              <div className="mt-4 space-y-2 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-success-soft)] p-4 text-sm text-[var(--color-success)]">
                <p className="font-semibold">Invitation accepted successfully.</p>
                <p>Tenant ID: {result.tenantId}</p>
                <p>Role: {result.role}</p>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className={secondaryButtonClassName}
                >
                  Go to dashboard
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </AuthGuard>
    </PublicShell>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={null}>
      <AcceptInvitationPageContent />
    </Suspense>
  );
}
