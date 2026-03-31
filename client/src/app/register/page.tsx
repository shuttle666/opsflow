"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PublicShell } from "@/components/ui/app-shell";
import { BrandMark } from "@/components/ui/brand-mark";
import { ArrowRight } from "@/components/ui/icons";
import {
  inputClassName,
  primaryButtonClassName,
  strongSurfaceClassName,
} from "@/components/ui/styles";
import { registerSchema, type RegisterFormValues } from "@/features/auth";
import { useAuthStore } from "@/store/auth-store";

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registerUser = useAuthStore((state) => state.register);
  const status = useAuthStore((state) => state.status);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const rawNext = searchParams.get("next");
  const nextPath = rawNext && rawNext.startsWith("/") ? rawNext : "/dashboard";

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
    <PublicShell>
      <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center py-6">
        <section className={`${strongSurfaceClassName} w-full max-w-[28rem] p-8 sm:p-10`}>
          <div className="space-y-3 text-center">
            <div className="flex items-center justify-center gap-3">
              <BrandMark className="h-11 w-11 drop-shadow-[0_16px_28px_-18px_rgba(8,145,178,0.8)]" />
              <span className="text-[2rem] font-semibold tracking-tight text-slate-950">
                OpsFlow
              </span>
            </div>
            <p className="pt-4 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">
              Register
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Create your workspace
            </h1>
            <p className="text-sm leading-6 text-slate-500">
              Create the first account for your tenant and continue straight into
              the workspace.
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                {...register("email")}
                className={`${inputClassName} mt-1`}
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
                className={`${inputClassName} mt-1`}
                placeholder="minimum 8 characters"
              />
              {errors.password ? (
                <p className="text-sm text-rose-600">{errors.password.message}</p>
              ) : null}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Display Name</span>
              <input
                {...register("displayName")}
                className={`${inputClassName} mt-1`}
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
                className={`${inputClassName} mt-1`}
                placeholder="Acme Home Services"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`${primaryButtonClassName} w-full`}
            >
              {isSubmitting ? "Creating account..." : "Create account"}
              <ArrowRight className="h-4 w-4" />
            </button>

            {submitError ? (
              <p className="text-sm text-center text-rose-600">{submitError}</p>
            ) : null}

            <p className="text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link
                href={`/login?next=${encodeURIComponent(nextPath)}`}
                className="font-semibold text-cyan-600 transition hover:text-cyan-700"
              >
                Sign in
              </Link>
            </p>
          </form>
        </section>
      </div>
    </PublicShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}
