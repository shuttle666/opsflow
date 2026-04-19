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
      return "border-[var(--color-app-border)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]";
    case "success":
      return "border-[var(--color-app-border)] bg-[var(--color-success-soft)] text-[var(--color-success)]";
    case "warning":
      return "border-[var(--color-app-border)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]";
    case "danger":
      return "border-[var(--color-app-border)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]";
    case "indigo":
      return "border-[var(--color-app-border)] bg-[var(--color-brand-surface)] text-[var(--color-brand)]";
    default:
      return "border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] text-[var(--color-text-secondary)]";
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
    case "PENDING_REVIEW":
      return "brand";
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

const statusLabels: Record<string, string> = {
  NEW: "New",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  PENDING_REVIEW: "Pending review",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  ACTIVE: "Active",
  INVITED: "Invited",
  DISABLED: "Disabled",
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  EXPIRED: "Expired",
  OWNER: "Owner",
  MANAGER: "Manager",
  STAFF: "Staff",
};

export function formatBadgeLabel(value: string) {
  return statusLabels[value] ?? value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
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
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current opacity-80"
      />
      {formatBadgeLabel(props.value)}
    </span>
  );
}
