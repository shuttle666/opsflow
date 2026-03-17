"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppShell } from "@/components/ui/app-shell";
import { SectionCard } from "@/components/ui/section-card";
import { loginSchema, type LoginFormValues } from "@/features/auth/login-schema";
import { useAuthStore } from "@/store/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "ops.manager@example.com",
      password: "password123",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    await login(values);
    router.push("/dashboard");
  };

  return (
    <AppShell
      title="Login placeholder"
      description="This form is connected to React Hook Form, Zod, and the local Zustand store. It does not call the backend yet."
    >
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          eyebrow="Why this exists"
          title="Authentication wiring without backend coupling"
          description="The page is ready for future token handling, API mutations, and route guards while staying intentionally lightweight for now."
        >
          <ul className="space-y-3 text-sm text-slate-600">
            <li>Validated with Zod before submit.</li>
            <li>Managed with React Hook Form for ergonomics.</li>
            <li>Writes to a placeholder auth store for future integration.</li>
          </ul>
        </SectionCard>

        <SectionCard
          eyebrow="Form"
          title="Sign in to OpsFlow"
          description="Use the seeded values or replace them. Submission simulates a successful login locally."
        >
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                {...register("email")}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="ops.manager@example.com"
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
                placeholder="password123"
              />
              {errors.password ? (
                <p className="text-sm text-rose-600">
                  {errors.password.message}
                </p>
              ) : null}
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </SectionCard>
      </div>
    </AppShell>
  );
}
