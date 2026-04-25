import { ApiError } from "../../utils/api-error";

export type ScheduleDraftWithLocalTime = {
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  localDate?: string | null;
  localEndDate?: string | null;
  localStartTime?: string | null;
  localEndTime?: string | null;
  timezone: string;
};

type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function assertKnownTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new ApiError(400, `Invalid timezone: ${timezone}`);
  }
}

function parseLocalDateTime(localDate: string, localTime: string): LocalDateTimeParts {
  const dateMatch = localDate.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  const timeMatch = localTime.match(/^(\d{2}):(\d{2})$/u);

  if (!dateMatch || !timeMatch) {
    throw new ApiError(400, "Local schedule date/time must use YYYY-MM-DD and HH:mm.");
  }

  return {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: 0,
  };
}

function getLocalParts(date: Date, timezone: string): LocalDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function partsToUtcMs(parts: LocalDateTimeParts) {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

function getTimezoneOffsetMs(date: Date, timezone: string) {
  const localParts = getLocalParts(date, timezone);
  return partsToUtcMs(localParts) - date.getTime();
}

function sameLocalParts(left: LocalDateTimeParts, right: LocalDateTimeParts) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

export function localWallTimeToUtcIso(input: {
  localDate: string;
  localTime: string;
  timezone: string;
}) {
  assertKnownTimezone(input.timezone);
  const targetParts = parseLocalDateTime(input.localDate, input.localTime);
  let utcMs = partsToUtcMs(targetParts);

  for (let index = 0; index < 4; index += 1) {
    const offsetMs = getTimezoneOffsetMs(new Date(utcMs), input.timezone);
    const nextUtcMs = partsToUtcMs(targetParts) - offsetMs;

    if (Math.abs(nextUtcMs - utcMs) < 1) {
      break;
    }

    utcMs = nextUtcMs;
  }

  const utcDate = new Date(utcMs);
  if (!sameLocalParts(getLocalParts(utcDate, input.timezone), targetParts)) {
    throw new ApiError(
      400,
      `Local time ${input.localDate} ${input.localTime} does not exist in ${input.timezone}.`,
    );
  }

  return utcDate.toISOString();
}

export function normalizeScheduleDraftTimezone(
  draft: ScheduleDraftWithLocalTime,
): ScheduleDraftWithLocalTime {
  const localDate = draft.localDate?.trim() || undefined;
  const localEndDate = draft.localEndDate?.trim() || undefined;
  const localStartTime = draft.localStartTime?.trim() || undefined;
  const localEndTime = draft.localEndTime?.trim() || undefined;

  if (localDate || localEndDate || localStartTime || localEndTime) {
    if (!localDate || !localStartTime || !localEndTime) {
      throw new ApiError(
        400,
        "Local schedule updates require localDate, localStartTime, and localEndTime.",
      );
    }

    const scheduledStartAt = localWallTimeToUtcIso({
      localDate,
      localTime: localStartTime,
      timezone: draft.timezone,
    });
    const scheduledEndAt = localWallTimeToUtcIso({
      localDate: localEndDate ?? localDate,
      localTime: localEndTime,
      timezone: draft.timezone,
    });

    if (new Date(scheduledEndAt) <= new Date(scheduledStartAt)) {
      throw new ApiError(400, "End time must be after the start time.");
    }

    return {
      ...draft,
      localDate,
      localEndDate,
      localStartTime,
      localEndTime,
      scheduledStartAt,
      scheduledEndAt,
    };
  }

  const start = draft.scheduledStartAt?.trim() || null;
  const end = draft.scheduledEndAt?.trim() || null;

  if ((start && !end) || (!start && end)) {
    throw new ApiError(400, "Both start and end time are required when scheduling a job.");
  }

  if (start && end && new Date(end) <= new Date(start)) {
    throw new ApiError(400, "End time must be after the start time.");
  }

  return {
    ...draft,
    scheduledStartAt: start,
    scheduledEndAt: end,
  };
}
