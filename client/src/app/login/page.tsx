"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PublicShell } from "@/components/ui/app-shell";
import { ArrowRight } from "@/components/ui/icons";
import {
  inputClassName,
  primaryButtonClassName,
  strongSurfaceClassName,
  surfaceClassName,
} from "@/components/ui/styles";
import { loginSchema, type LoginFormValues } from "@/features/auth/login-schema";
import { useAuthStore } from "@/store/auth-store";

const seededAccounts = [
  {
    label: "Owner",
    email: "owner@acme.example",
    password: "owner-password-123",
  },
  {
    label: "Manager",
    email: "manager@acme.example",
    password: "manager-password-123",
  },
  {
    label: "Staff",
    email: "staff@acme.example",
    password: "staff-password-123",
  },
] as const;

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const login = useAuthStore((state) => state.login);
  const status = useAuthStore((state) => state.status);

  const rawNext = searchParams.get("next");
  const nextPath = rawNext && rawNext.startsWith("/") ? rawNext : "/dashboard";

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(nextPath);
    }
  }, [status, nextPath, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);

    try {
      await login(values);
      router.push(nextPath);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Login failed. Please try again.";
      setSubmitError(message);
    }
  };

  return (
    <PublicShell>
      <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center py-6">
        <div className="w-full max-w-[26rem]">
          <section className={`${strongSurfaceClassName} p-8 sm:p-10`}>
            <div className="flex items-center justify-center gap-3">
              <span className="h-11 w-11 rounded-full bg-linear-to-br from-sky-500 to-cyan-600 shadow-[0_16px_28px_-18px_rgba(8,145,178,0.8)]" />
              <span className="text-[2rem] font-semibold tracking-tight text-slate-950">
                OpsFlow
              </span>
            </div>

            <div className="mt-8 text-center">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Welcome back
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Sign in to your workspace
              </p>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <input
                  {...register("email")}
                  className={`${inputClassName} mt-1`}
                  placeholder="name@company.com"
                  autoComplete="email"
                />
                {errors.email ? (
                  <p className="mt-2 text-sm text-rose-600">{errors.email.message}</p>
                ) : null}
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Password</span>
                <input
                  {...register("password")}
                  type="password"
                  className={`${inputClassName} mt-1`}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                {errors.password ? (
                  <p className="mt-2 text-sm text-rose-600">{errors.password.message}</p>
                ) : null}
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`${primaryButtonClassName} mt-2 w-full`}
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
                <ArrowRight className="h-4 w-4" />
              </button>

              {submitError ? (
                <p className="text-sm text-center text-rose-600">{submitError}</p>
              ) : null}

              <p className="text-center text-sm text-slate-500">
                Don&apos;t have an account?{" "}
                <Link
                  href={`/register?next=${encodeURIComponent(nextPath)}`}
                  className="font-semibold text-cyan-600 transition hover:text-cyan-700"
                >
                  Register
                </Link>
              </p>
            </form>
          </section>

          <details className={`${surfaceClassName} mt-4 px-5 py-4 text-sm text-slate-600`}>
            <summary className="cursor-pointer list-none font-semibold text-slate-700">
              Local dev accounts
            </summary>
            <ul className="mt-4 space-y-3">
              {seededAccounts.map((account) => (
                <li
                  key={account.email}
                  className="rounded-[1rem] border border-white/80 bg-white/80 px-4 py-3"
                >
                  <p className="font-semibold text-slate-950">{account.label}</p>
                  <p className="mt-1">
                    Email: <span className="font-mono text-[13px]">{account.email}</span>
                  </p>
                  <p>
                    Password:{" "}
                    <span className="font-mono text-[13px]">{account.password}</span>
                  </p>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </PublicShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
