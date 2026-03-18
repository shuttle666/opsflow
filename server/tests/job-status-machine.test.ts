import { JobStatus } from "@prisma/client";
import {
  assertValidTransition,
  canTransition,
  JobDomainError,
} from "../src/modules/job";

describe("job status state machine", () => {
  it("allows defined transition edges", () => {
    expect(canTransition(JobStatus.NEW, JobStatus.SCHEDULED)).toBe(true);
    expect(canTransition(JobStatus.NEW, JobStatus.CANCELLED)).toBe(true);
    expect(canTransition(JobStatus.SCHEDULED, JobStatus.IN_PROGRESS)).toBe(
      true,
    );
    expect(canTransition(JobStatus.IN_PROGRESS, JobStatus.COMPLETED)).toBe(
      true,
    );
  });

  it("rejects invalid transition edges", () => {
    expect(canTransition(JobStatus.NEW, JobStatus.COMPLETED)).toBe(false);
    expect(canTransition(JobStatus.COMPLETED, JobStatus.NEW)).toBe(false);
  });

  it("throws a domain error for invalid transitions", () => {
    expect(() =>
      assertValidTransition(JobStatus.CANCELLED, JobStatus.SCHEDULED),
    ).toThrowError(JobDomainError);
  });
});

