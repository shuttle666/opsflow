import type { ComponentType, ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export type IconComponent = ComponentType<IconProps>;

function IconBase({
  children,
  className,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ArrowRight(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </IconBase>
  );
}

export function Briefcase(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 6V4h6v2" />
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 11h18" />
    </IconBase>
  );
}

export function ShieldCheck(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m12 3 7 3v5c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10V6l7-3Z" />
      <path d="m9.5 12 1.8 1.8 3.7-4.1" />
    </IconBase>
  );
}

export function Users(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M16 21v-1.5a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4V21" />
      <circle cx="10" cy="8" r="3" />
      <path d="M20 21v-1a3.5 3.5 0 0 0-2.8-3.4" />
      <path d="M15.5 5.2a3 3 0 0 1 0 5.6" />
    </IconBase>
  );
}

export function Bell(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </IconBase>
  );
}

export function BellRing(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7" />
      <path d="M10 20a2 2 0 0 0 4 0" />
      <path d="M3 8c0-1.2.3-2.3 1-3.3" />
      <path d="M20 4.7c.7 1 .9 2.1 1 3.3" />
    </IconBase>
  );
}

export function Building2(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 21V7l6-4 6 4v14" />
      <path d="M4 21h16" />
      <path d="M9 10h1" />
      <path d="M14 10h1" />
      <path d="M9 14h1" />
      <path d="M14 14h1" />
      <path d="M11 21v-4h2v4" />
    </IconBase>
  );
}

export function Home(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m3 11 9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </IconBase>
  );
}

export function LogOut(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </IconBase>
  );
}

export function Search(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </IconBase>
  );
}

export function UserPlus(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="8" r="4" />
      <path d="M4 20a6 6 0 0 1 12 0" />
      <path d="M19 8v6" />
      <path d="M16 11h6" />
    </IconBase>
  );
}

export function CheckCircle2(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.2 2.3 4.8-5.2" />
    </IconBase>
  );
}

export function FileClock(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <circle cx="12" cy="14" r="3" />
      <path d="M12 12.5v1.8l1.2.7" />
    </IconBase>
  );
}

export function History(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </IconBase>
  );
}

export function CircleUserRound(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7.5 18a5.5 5.5 0 0 1 9 0" />
    </IconBase>
  );
}

export function Layers3(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m12 3 8 4-8 4-8-4 8-4Z" />
      <path d="m4 11 8 4 8-4" />
      <path d="m4 15 8 4 8-4" />
    </IconBase>
  );
}
