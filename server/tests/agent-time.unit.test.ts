import {
  localWallTimeToUtcIso,
  normalizeScheduleDraftTimezone,
} from "../src/modules/agent/agent-time";

describe("agent time helpers", () => {
  it("converts Adelaide local wall time after daylight saving has ended", () => {
    expect(
      localWallTimeToUtcIso({
        localDate: "2026-04-24",
        localTime: "14:00",
        timezone: "Australia/Adelaide",
      }),
    ).toBe("2026-04-24T04:30:00.000Z");
  });

  it("converts Adelaide local wall time during daylight saving", () => {
    expect(
      localWallTimeToUtcIso({
        localDate: "2026-01-15",
        localTime: "14:00",
        timezone: "Australia/Adelaide",
      }),
    ).toBe("2026-01-15T03:30:00.000Z");
  });

  it("normalizes local schedule drafts without trusting model-supplied UTC", () => {
    expect(
      normalizeScheduleDraftTimezone({
        scheduledStartAt: "2026-04-24T03:30:00.000Z",
        scheduledEndAt: "2026-04-24T05:30:00.000Z",
        localDate: "2026-04-24",
        localStartTime: "14:00",
        localEndTime: "16:00",
        timezone: "Australia/Adelaide",
      }),
    ).toEqual(
      expect.objectContaining({
        scheduledStartAt: "2026-04-24T04:30:00.000Z",
        scheduledEndAt: "2026-04-24T06:30:00.000Z",
      }),
    );
  });
});
