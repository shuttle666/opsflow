import type { APIRequestContext, Request } from "@playwright/test";

const apiBaseUrl = (
  process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000/api"
).replace(/\/$/u, "");

type JobListItem = {
  id: string;
  title: string;
};

type JobListResponse = {
  success: true;
  data?: JobListItem[];
};

export function requireBearerAuthorization(request: Request) {
  const authorization = request.headers().authorization;

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Expected the Agent request to include a Bearer token.");
  }

  return authorization;
}

export async function findJobsByExactTitle(
  api: APIRequestContext,
  authorization: string,
  title: string,
) {
  const query = new URLSearchParams({
    q: title,
    page: "1",
    pageSize: "50",
  });
  const response = await api.get(`${apiBaseUrl}/jobs?${query.toString()}`, {
    headers: { Authorization: authorization },
  });

  if (!response.ok()) {
    throw new Error(
      `Jobs API returned ${response.status()} while looking up ${JSON.stringify(title)}.`,
    );
  }

  const payload = (await response.json()) as JobListResponse;
  return (payload.data ?? []).filter((job) => job.title === title);
}
