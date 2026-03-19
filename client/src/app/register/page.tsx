"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppShell } from "@/components/ui/app-shell";
import { SectionCard } from "@/components/ui/section-card";
import { registerSchema, type RegisterFormValues } from "@/features/auth";
import { useAuthStore } from "@/store/auth-store";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registerUser = useAuthStore((state) => state.register);
  const status = useAuthStore((state) => state.status);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    const rawNext = searchParams.get("next");
    if (!rawNext || !rawNext.startsWith("/")) {
      return "/dashboard";
    }

    return rawNext;
  }, [searchParams]);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(nextPath);
    }
  }, [nextPath, router, status]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      displayName: "",
      tenantName: "",
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setSubmitError(null);

    try {
      await registerUser({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
        tenantName: values.tenantName?.trim() ? values.tenantName : undefined,
      });
      router.push(nextPath);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Registration failed. Please try again.";
      setSubmitError(message);
    }
  };

  return (
    <AppShell
      title="Create your OpsFlow workspace"
      description="Register a new account and tenant, then continue directly into your operational dashboard."
    >
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          eyebrow="Onboarding"
          title="Fast account bootstrap"
          description="Registration creates your initial tenant and signs you in immediately."
        >
          <ul className="space-y-3 text-sm text-slate-600">
            <li>Securely validated with Zod + React Hook Form.</li>
            <li>Returns access and refresh tokens after account creation.</li>
            <li>Redirects to your dashboard when setup is complete.</li>
          </ul>
        </SectionCard>

        <SectionCard
          eyebrow="Form"
          title="Register account"
          description="Tenant name is optional. If omitted, OpsFlow creates a default workspace name."
        >
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                {...register("email")}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="owner@acme.example"
              />
              {errors.email ? (
                <p className="text-sm text-rose-600">{errors.email.message}</p>
              ) : null}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <input
                {...register("password")}
                type="password"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="minimum 8 characters"
              />
              {errors.password ? (
                <p className="text-sm text-rose-600">{errors.password.message}</p>
              ) : null}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Display Name
              </span>
              <input
                {...register("displayName")}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="Avery Owner"
              />
              {errors.displayName ? (
                <p className="text-sm text-rose-600">{errors.displayName.message}</p>
              ) : null}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Tenant Name (optional)
              </span>
              <input
                {...register("tenantName")}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="Acme Home Services"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>

            {submitError ? (
              <p className="text-sm text-rose-600">{submitError}</p>
            ) : null}

            <p className="text-sm text-slate-600">
              Already have an account?{" "}
              <Link
                href={`/login?next=${encodeURIComponent(nextPath)}`}
                className="font-semibold text-cyan-700 hover:text-cyan-800"
              >
                Sign in
              </Link>
            </p>
          </form>
        </SectionCard>
      </div>
    </AppShell>
  );
}
