"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { SectionCard } from "@/components/ui/section-card";
import {
  invitationCreateSchema,
  type InvitationCreateFormValues,
} from "@/features/auth";
import { useAuthStore } from "@/store/auth-store";
import type { MembershipRole } from "@/types/auth";

const INVITER_ROLES: MembershipRole[] = ["OWNER", "MANAGER"];

function canCreateInvitation(role: MembershipRole | undefined) {
  if (!role) {
    return false;
  }

  return INVITER_ROLES.includes(role);
}

async function copyText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === "undefined") {
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function InvitationCreateCard() {
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const createInvitation = useAuthStore((state) => state.createInvitation);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [created, setCreated] = useState<{
    token: string;
    expiresAt: string;
    email: string;
    role: "MANAGER" | "STAFF";
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<InvitationCreateFormValues>({
    resolver: zodResolver(invitationCreateSchema),
    defaultValues: {
      email: "",
      role: "STAFF",
    },
  });

  if (!currentTenant) {
    return (
      <SectionCard
        eyebrow="Team access"
        title="Create invitation"
        description="Tenant context is not available yet."
      >
        <p className="text-sm text-slate-600">Please refresh your session first.</p>
      </SectionCard>
    );
  }

  const allowed = canCreateInvitation(currentTenant.role);
  if (!allowed) {
    return (
      <SectionCard
        eyebrow="Team access"
        title="Create invitation"
        description="Only OWNER or MANAGER can invite members in this tenant."
      >
        <p className="text-sm text-slate-600">
          Your current role is <span className="font-semibold">{currentTenant.role}</span>.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      eyebrow="Team access"
      title="Create invitation"
      description="Invite team members with MANAGER or STAFF role. Token sharing is manual in this stage."
    >
      <form
        className="space-y-4"
        onSubmit={handleSubmit(async (values) => {
          setError(null);
          setCopied(false);

          try {
            const result = await createInvitation(values);
            setCreated({
              token: result.token,
              expiresAt: result.expiresAt,
              email: result.email,
              role: result.role,
            });
            reset({
              email: "",
              role: values.role,
            });
          } catch (submitError) {
            const message =
              submitError instanceof Error
                ? submitError.message
                : "Failed to create invitation.";
            setError(message);
          }
        })}
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Invitee email</span>
          <input
            {...register("email")}
            placeholder="new.member@example.com"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />
          {errors.email ? (
            <p className="text-sm text-rose-600">{errors.email.message}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Role</span>
          <select
            {...register("role")}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          >
            <option value="MANAGER">MANAGER</option>
            <option value="STAFF">STAFF</option>
          </select>
          {errors.role ? (
            <p className="text-sm text-rose-600">{errors.role.message}</p>
          ) : null}
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "Creating..." : "Create invitation"}
        </button>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </form>

      {created ? (
        <div className="mt-5 space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">Invitation created successfully.</p>
          <p>Email: {created.email}</p>
          <p>Role: {created.role}</p>
          <p>Expires at: {new Date(created.expiresAt).toLocaleString()}</p>
          <p className="break-all font-mono text-xs">Token: {created.token}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void copyText(created.token).then(() => setCopied(true));
              }}
              className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              {copied ? "Copied" : "Copy token"}
            </button>
            <a
              href={`/invitations/accept?token=${encodeURIComponent(created.token)}`}
              className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              Open accept page
            </a>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}
