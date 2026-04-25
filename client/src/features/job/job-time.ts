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

function sameLocalDate(left: Date, right: Date, timeZone?: string) {
  if (!timeZone) {
    return left.toDateString() === right.toDateString();
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(left) === formatter.format(right);
}

export function formatScheduleRange(
  scheduledStartAt: string | null,
  scheduledEndAt: string | null,
  timeZone?: string,
) {
  if (!scheduledStartAt || !scheduledEndAt) {
    return "-";
  }

  const start = new Date(scheduledStartAt);
  const end = new Date(scheduledEndAt);
  const sameDay = sameLocalDate(start, end, timeZone);
  const dateOptions: Intl.DateTimeFormatOptions = timeZone
    ? { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }
    : {};
  const timeOptions: Intl.DateTimeFormatOptions = {
    ...dateOptions,
    hour: "2-digit",
    minute: "2-digit",
  };

  if (sameDay) {
    return `${start.toLocaleDateString([], dateOptions)} ${start.toLocaleTimeString([], timeOptions)} - ${end.toLocaleTimeString([], timeOptions)}`;
  }

  return `${start.toLocaleDateString([], dateOptions)} ${start.toLocaleTimeString([], timeOptions)} - ${end.toLocaleDateString([], dateOptions)} ${end.toLocaleTimeString([], timeOptions)}`;
}

export function formatTimeRange(
  scheduledStartAt: string | null,
  scheduledEndAt: string | null,
  timeZone?: string,
) {
  if (!scheduledStartAt || !scheduledEndAt) {
    return "-";
  }

  const start = new Date(scheduledStartAt);
  const end = new Date(scheduledEndAt);
  const options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  };

  return `${start.toLocaleTimeString([], options)} - ${end.toLocaleTimeString([], options)}`;
}
