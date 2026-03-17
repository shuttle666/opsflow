import Link from "next/link";

type AppShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

const navigation = [
  { href: "/", label: "Home" },
  { href: "/login", label: "Login" },
  { href: "/dashboard", label: "Dashboard" },
];

export function AppShell({ title, description, children }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-app-border/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">
              OpsFlow
            </p>
            <p className="text-sm text-slate-500">
              Full-stack operations platform starter
            </p>
          </div>

          <nav className="flex items-center gap-2 rounded-full border border-app-border bg-white p-1">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
        <section className="rounded-[2rem] border border-app-border bg-white/80 p-8 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.45)]">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
              Foundation only
            </span>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950">
              {title}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-slate-600">
              {description}
            </p>
          </div>
        </section>

        {children}
      </main>
    </div>
  );
}
