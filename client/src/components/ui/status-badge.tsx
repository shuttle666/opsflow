import type { InvitationStatus, MembershipStatus, MembershipRole } from "@/types/auth";
import type { JobStatus } from "@/types/job";
import { badgeBaseClassName, cn } from "@/components/ui/styles";

type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "indigo";

function toneClassName(tone: BadgeTone) {
  switch (tone) {
    case "brand":
      return "border-sky-100 bg-sky-50 text-sky-700";
    case "success":
      return "border-emerald-100 bg-emerald-50 text-emerald-600";
    case "warning":
      return "border-amber-100 bg-amber-50 text-amber-600";
    case "danger":
      return "border-rose-100 bg-rose-50 text-rose-600";
    case "indigo":
      return "border-indigo-100 bg-indigo-50 text-indigo-600";
    default:
      return "border-slate-200 bg-slate-50 text-slate-500";
  }
}

function jobTone(status: JobStatus): BadgeTone {
  switch (status) {
    case "NEW":
      return "brand";
    case "SCHEDULED":
      return "indigo";
    case "IN_PROGRESS":
      return "warning";
    case "COMPLETED":
      return "success";
    case "CANCELLED":
      return "danger";
  }
}

function membershipTone(status: MembershipStatus): BadgeTone {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "INVITED":
      return "brand";
    case "DISABLED":
      return "danger";
  }
}

function invitationTone(status: InvitationStatus): BadgeTone {
  switch (status) {
    case "PENDING":
      return "brand";
    case "ACCEPTED":
      return "success";
    case "CANCELLED":
      return "danger";
    case "EXPIRED":
      return "neutral";
  }
}

function roleTone(role: MembershipRole): BadgeTone {
  switch (role) {
    case "OWNER":
      return "brand";
    case "MANAGER":
      return "indigo";
    case "STAFF":
      return "neutral";
  }
}

type StatusBadgeProps =
  | { kind: "job"; value: JobStatus; className?: string }
  | { kind: "membership"; value: MembershipStatus; className?: string }
  | { kind: "invitation"; value: InvitationStatus; className?: string }
  | { kind: "role"; value: MembershipRole; className?: string };

export function StatusBadge(props: StatusBadgeProps) {
  const tone =
    props.kind === "job"
      ? jobTone(props.value)
      : props.kind === "membership"
        ? membershipTone(props.value)
        : props.kind === "invitation"
          ? invitationTone(props.value)
          : roleTone(props.value);

  return (
    <span className={cn(badgeBaseClassName, toneClassName(tone), props.className)}>
      {props.value}
    </span>
  );
}
