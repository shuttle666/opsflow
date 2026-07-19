import { describe, expect, it } from "vitest";
import {
  formatScheduleRange,
  formatTimeZoneName,
} from "./job-time";

describe("job time formatting", () => {
  const scheduledStartAt = "2026-07-20T04:00:00.000Z";
  const scheduledEndAt = "2026-07-20T05:00:00.000Z";

  it("keeps the same instant clear across Melbourne and Adelaide", () => {
    const melbourneRange = formatScheduleRange(
      scheduledStartAt,
      scheduledEndAt,
      "Australia/Melbourne",
    );
    const adelaideRange = formatScheduleRange(
      scheduledStartAt,
      scheduledEndAt,
      "Australia/Adelaide",
    );

    expect(melbourneRange).toMatch(/02:00.*03:00/u);
    expect(melbourneRange).toContain(
      formatTimeZoneName(scheduledStartAt, "Australia/Melbourne"),
    );
    expect(adelaideRange).toMatch(/01:30.*02:30/u);
    expect(adelaideRange).toContain(
      formatTimeZoneName(scheduledStartAt, "Australia/Adelaide"),
    );
    expect(adelaideRange).not.toBe(melbourneRange);

    const adelaideDate = new Date(scheduledStartAt).toLocaleDateString([], {
      timeZone: "Australia/Adelaide",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    expect(adelaideRange.split(adelaideDate)).toHaveLength(2);
  });

  it("returns the empty schedule placeholder", () => {
    expect(formatScheduleRange(null, scheduledEndAt)).toBe("-");
    expect(formatScheduleRange(scheduledStartAt, null)).toBe("-");
  });
});
