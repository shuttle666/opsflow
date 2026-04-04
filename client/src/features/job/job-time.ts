export function toApiDateTime(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? new Date(trimmed).toISOString() : "";
}

export function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export function formatScheduleRange(
  scheduledStartAt: string | null,
  scheduledEndAt: string | null,
) {
  if (!scheduledStartAt || !scheduledEndAt) {
    return "-";
  }

  const start = new Date(scheduledStartAt);
  const end = new Date(scheduledEndAt);
  const sameDay = start.toDateString() === end.toDateString();

  if (sameDay) {
    return `${start.toLocaleDateString()} ${start.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })} - ${end.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  return `${start.toLocaleString()} - ${end.toLocaleString()}`;
}

export function formatTimeRange(
  scheduledStartAt: string | null,
  scheduledEndAt: string | null,
) {
  if (!scheduledStartAt || !scheduledEndAt) {
    return "-";
  }

  const start = new Date(scheduledStartAt);
  const end = new Date(scheduledEndAt);

  return `${start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })} - ${end.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
