import { JobStatus, MembershipRole } from "@prisma/client";
import type { AuthContext } from "../src/types/auth";

const jobMocks = vi.hoisted(() => ({
  listJobs: vi.fn(),
}));

vi.mock("../src/modules/job/job.service", () => ({
  listJobs: jobMocks.listJobs,
}));

import { searchJobsTool } from "../src/modules/operations-tools/definitions/search-jobs.tool";

const auth: AuthContext = {
  userId: "user-1",
  sessionId: "session-1",
  tenantId: "tenant-1",
  role: MembershipRole.MANAGER,
};

describe("search_jobs canonical tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates tenant-scoped queries to the job service", async () => {
    const result = {
      items: [
        {
          id: "job-1",
          title: "Leak repair",
          serviceAddress: "1 King Street",
          status: JobStatus.NEW,
          scheduledStartAt: null,
          scheduledEndAt: null,
          createdAt: new Date("2026-07-14T00:00:00.000Z"),
          updatedAt: new Date("2026-07-14T00:00:00.000Z"),
          customer: { id: "customer-1", name: "Archie Wright" },
        },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
    };
    jobMocks.listJobs.mockResolvedValueOnce(result);

    await expect(
      searchJobsTool.execute(
        auth,
        {
          q: "leak",
          status: JobStatus.NEW,
          page: 1,
          pageSize: 10,
        },
        { source: "WEB_AGENT", invocationId: "invocation-1" },
      ),
    ).resolves.toEqual(result);

    expect(jobMocks.listJobs).toHaveBeenCalledWith(auth, {
      q: "leak",
      status: JobStatus.NEW,
      customerId: undefined,
      scheduledFrom: undefined,
      scheduledTo: undefined,
      page: 1,
      pageSize: 10,
      sort: "createdAt_desc",
    });
  });
});
