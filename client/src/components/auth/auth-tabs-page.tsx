"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BrandMark } from "@/components/ui/brand-mark";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPulse } from "@/components/ui/loading-panel";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  CircleUserRound,
  LockKeyhole,
  Mail,
  Sparkles,
  type IconComponent,
} from "@/components/ui/icons";
import {
  cn,
} from "@/components/ui/styles";
import { loginSchema, type LoginFormValues } from "@/features/auth/login-schema";
import { registerSchema, type RegisterFormValues } from "@/features/auth";
import { writeGoldenDemoProgress } from "@/features/golden-demo";
import { getApiErrorView, type ApiErrorView } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

type AuthMode = "login" | "register";

type AuthTabsPageProps = {
  initialMode?: AuthMode;
};

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

const authVideoUrl = "/opsflow-hero-bg.mp4";

const authFieldClassName =
  "h-14 w-full rounded-[22px] border border-[var(--color-app-border)] bg-[color-mix(in_srgb,var(--color-app-panel)_84%,transparent)] py-0 pl-16 pr-4 text-sm text-[var(--color-text)] shadow-sm outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus:ring-[3px] focus:ring-[var(--color-brand-soft)]";

const demoActionClassName =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[16px] bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-[3px] focus:ring-[var(--color-brand-soft)]";

function AuthField({
  icon: Icon,
  label,
  error,
  children,
}: {
  icon: IconComponent;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--color-app-panel-muted)] text-[var(--color-text-muted)]">
          <Icon className="h-4 w-4" />
        </span>
        {children}
      </span>
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
    </label>
  );
}

function AuthTabsPageContent({ initialMode = "login" }: AuthTabsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedDemoRole = searchParams.get("demo")?.toLowerCase();
  const requestedDemoAccount = seededAccounts.find(
    (account) => account.label.toLowerCase() === requestedDemoRole,
  );
  const login = useAuthStore((state) => state.login);
  const registerUser = useAuthStore((state) => state.register);
  const startPrivateDemo = useAuthStore((state) => state.startPrivateDemo);
  const status = useAuthStore((state) => state.status);
  const [mode, setMode] = useState<AuthMode>(() =>
    searchParams.get("mode") === "register" ? "register" : initialMode,
  );
  const [submitError, setSubmitError] = useState<ApiErrorView | null>(null);
  const [isPrivateDemoStarting, setIsPrivateDemoStarting] = useState(false);
  const [selectedDemoEmail, setSelectedDemoEmail] = useState<string | null>(
    requestedDemoAccount?.email ?? null,
  );
  const privateDemoRedirectPending = useRef(false);

  const rawNext = searchParams.get("next");
  const nextPath = rawNext && rawNext.startsWith("/") ? rawNext : "/dashboard";

  useEffect(() => {
    if (status === "authenticated" && !privateDemoRedirectPending.current) {
      router.replace(nextPath);
    }
  }, [status, nextPath, router]);

  const {
    register: registerLoginField,
    handleSubmit: handleLoginSubmit,
    setValue: setLoginValue,
    formState: { errors: loginErrors, isSubmitting: isLoginSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: requestedDemoAccount?.email ?? "",
      password: requestedDemoAccount?.password ?? "",
    },
  });

  const {
    register: registerRegisterField,
    handleSubmit: handleRegisterSubmit,
    formState: { errors: registerErrors, isSubmitting: isRegisterSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      displayName: "",
      tenantName: "",
    },
  });

  const onLoginSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);

    try {
      await login(values);
      router.push(nextPath);
    } catch (error) {
      setSubmitError(getApiErrorView(error, "Login failed. Please try again."));
    }
  };

  const onRegisterSubmit = async (values: RegisterFormValues) => {
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
      setSubmitError(getApiErrorView(error, "Registration failed. Please try again."));
    }
  };

  const onPrivateDemoStart = async () => {
    if (privateDemoRedirectPending.current) {
      return;
    }

    setSubmitError(null);
    setIsPrivateDemoStarting(true);
    privateDemoRedirectPending.current = true;

    try {
      await startPrivateDemo();
      writeGoldenDemoProgress("started", 0);
      router.push("/agent");
    } catch (error) {
      setSubmitError(
        getApiErrorView(error, "Quick demo could not be created. Please try again."),
      );
      privateDemoRedirectPending.current = false;
      setIsPrivateDemoStarting(false);
    }
  };

  const switchMode = (nextMode: AuthMode) => {
    setSubmitError(null);
    setSelectedDemoEmail(null);
    setMode(nextMode);
  };

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-white px-4 py-6 text-[var(--color-text)] sm:px-6">
      <video
        className="landing-video-media absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      >
        <source src={authVideoUrl} type="video/mp4" />
      </video>
      <div className="auth-video-tint" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1240px] items-center justify-center pb-16 pt-24 sm:pt-28">
        <section className="w-full max-w-[31rem] rounded-[28px] border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-app-panel)_78%,transparent)] p-3 shadow-[0_30px_90px_-55px_rgba(15,23,42,0.55)] backdrop-blur-xl">
          <div className="rounded-[22px] border border-[var(--color-app-border)] bg-[color-mix(in_srgb,var(--color-app-panel)_74%,transparent)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] sm:p-7">
            <Link href="/" className="mx-auto flex min-h-11 w-fit items-center justify-center">
              <BrandMark
                variant="wordmark"
                decorative={false}
                className="h-9 w-[170px]"
              />
            </Link>

            <div className="mt-5 text-center">
            <h1 className="text-2xl font-extrabold text-[var(--color-text)]">
              {mode === "login" ? "Welcome back" : "Create your workspace"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              {mode === "login"
                ? "Sign in to continue dispatching the day."
                : "Create the first account for your team."}
            </p>
            </div>

            <div
              role="tablist"
              aria-label="Authentication mode"
              className="mt-6 grid grid-cols-2 rounded-[18px] border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-1"
            >
              {[
                { id: "login" as const, label: "Sign in" },
                { id: "register" as const, label: "Create account" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === tab.id}
                  onClick={() => switchMode(tab.id)}
                  className={cn(
                    "min-h-11 rounded-[15px] text-sm font-semibold transition",
                    mode === tab.id
                      ? "bg-[var(--color-app-panel)] text-[var(--color-text)] shadow-sm ring-1 ring-[var(--color-brand)]/35"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]",
                  )}
                >
                  {tab.id === "login" ? "Login" : "Register"}
                </button>
              ))}
            </div>

          {mode === "login" ? (
            <form
              aria-label="Sign in"
                className="mt-6 space-y-4"
              onSubmit={handleLoginSubmit(onLoginSubmit)}
            >
                <AuthField icon={Mail} label="Email" error={loginErrors.email?.message}>
                <input
                  {...registerLoginField("email")}
                    className={authFieldClassName}
                    placeholder="Work email"
                  autoComplete="email"
                />
                </AuthField>

                <AuthField
                  icon={LockKeyhole}
                  label="Password"
                  error={loginErrors.password?.message}
                >
                <input
                  {...registerLoginField("password")}
                  type="password"
                    className={authFieldClassName}
                    placeholder="Password"
                  autoComplete="current-password"
                />
                </AuthField>

              <button
                type="submit"
                disabled={isLoginSubmitting}
                  className="group inline-flex h-14 w-full items-center justify-center gap-2 rounded-[22px] bg-[var(--color-text)] px-5 text-sm font-semibold text-[var(--color-app-panel)] shadow-[0_18px_34px_-28px_rgba(0,0,0,0.72)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{isLoginSubmitting ? "Signing in..." : "Sign In"}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>

              {submitError ? (
                <InlineErrorBanner message={submitError} />
              ) : null}

              <section className="rounded-[20px] border border-[var(--color-brand)]/35 bg-[var(--color-brand-soft)] p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-app-panel)] text-[var(--color-brand)] shadow-sm">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-[var(--color-text)]">
                      Try a quick demo
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                      Get an isolated workspace with fictional sample data. It expires
                      automatically and never changes the shared demo account.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-busy={isPrivateDemoStarting}
                  disabled={isPrivateDemoStarting}
                  onClick={onPrivateDemoStart}
                  className={cn(
                    demoActionClassName,
                    "mt-4 disabled:cursor-wait",
                  )}
                >
                  {isPrivateDemoStarting ? (
                    <>
                      <LoadingPulse tone="inverse" />
                      <span>Preparing your workspace...</span>
                    </>
                  ) : (
                    <>
                      <span>Start a quick demo</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
                <p
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className={cn(
                    "mt-2 text-center",
                    isPrivateDemoStarting
                      ? "text-xs leading-5 text-[var(--color-text-secondary)]"
                      : "font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]",
                  )}
                >
                  {isPrivateDemoStarting
                    ? "Creating an isolated workspace and sample data. This may take a few seconds."
                    : "No sign-up · Isolated data · Automatic cleanup"}
                </p>
              </section>

              <details className="group rounded-[20px] border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-3 text-sm text-[var(--color-text-secondary)]">
                <summary
                  className={cn(
                    demoActionClassName,
                    "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
                  )}
                >
                  <span>Shared demo accounts</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-3 grid gap-2">
                  {seededAccounts.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      aria-label={`Use ${account.label} demo account`}
                      aria-pressed={selectedDemoEmail === account.email}
                      className="group flex w-full items-center justify-between gap-3 rounded-[16px] border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3.5 py-3 text-left shadow-sm transition hover:border-[var(--color-brand)] hover:bg-[var(--color-app-panel-muted)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-brand-soft)]"
                      onClick={() => {
                        setSubmitError(null);
                        setSelectedDemoEmail(account.email);
                        setLoginValue("email", account.email, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                        setLoginValue("password", account.password, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--color-text)]">
                          {account.label}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[11px] text-[var(--color-text-muted)]">
                          {account.email}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)] transition group-hover:border-[var(--color-brand)] group-hover:text-[var(--color-brand)]">
                        {selectedDemoEmail === account.email ? "Filled" : "Use"}
                      </span>
                    </button>
                  ))}
                </div>
              </details>
            </form>
          ) : (
            <form
              aria-label="Create account"
                className="mt-6 space-y-4"
              onSubmit={handleRegisterSubmit(onRegisterSubmit)}
            >
                <AuthField
                  icon={CircleUserRound}
                  label="Display Name"
                  error={registerErrors.displayName?.message}
                >
                <input
                    {...registerRegisterField("displayName")}
                    className={authFieldClassName}
                    placeholder="Full name"
                    autoComplete="name"
                />
                </AuthField>

                <AuthField icon={Mail} label="Email" error={registerErrors.email?.message}>
                <input
                    {...registerRegisterField("email")}
                    className={authFieldClassName}
                    placeholder="Work email"
                    autoComplete="email"
                />
                </AuthField>

                <AuthField
                  icon={LockKeyhole}
                  label="Password"
                  error={registerErrors.password?.message}
                >
                <input
                    {...registerRegisterField("password")}
                    type="password"
                    className={authFieldClassName}
                    placeholder="Password"
                    autoComplete="new-password"
                />
                </AuthField>

                <AuthField icon={Building2} label="Tenant Name (optional)">
                <input
                  {...registerRegisterField("tenantName")}
                    className={authFieldClassName}
                    placeholder="Workspace name"
                  autoComplete="organization"
                />
                </AuthField>

              <button
                type="submit"
                disabled={isRegisterSubmitting}
                  className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[22px] bg-[var(--color-text)] px-5 text-sm font-semibold text-[var(--color-app-panel)] shadow-[0_18px_34px_-28px_rgba(0,0,0,0.72)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRegisterSubmitting ? "Creating workspace..." : "Create workspace"}
                <ArrowRight className="h-4 w-4" />
              </button>

              {submitError ? (
                <InlineErrorBanner message={submitError} />
              ) : null}
            </form>
          )}
          </div>
        </section>
      </div>
    </main>
  );
}

export function AuthTabsPage(props: AuthTabsPageProps) {
  return (
    <Suspense fallback={null}>
      <AuthTabsPageContent {...props} />
    </Suspense>
  );
}
