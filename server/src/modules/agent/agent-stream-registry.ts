import type { Response } from "express";

const streamsByTenant = new Map<string, Set<Response>>();

export function registerAgentStream(tenantId: string, response: Response) {
  const streams = streamsByTenant.get(tenantId) ?? new Set<Response>();
  streams.add(response);
  streamsByTenant.set(tenantId, streams);

  const unregister = () => {
    streams.delete(response);
    if (streams.size === 0) {
      streamsByTenant.delete(tenantId);
    }
  };

  if (typeof response.once === "function") {
    response.once("close", unregister);
  }
  return unregister;
}

export function closeAgentStreamsForTenant(tenantId: string) {
  const streams = streamsByTenant.get(tenantId);
  if (!streams) {
    return;
  }

  for (const response of [...streams]) {
    response.end();
  }

  streamsByTenant.delete(tenantId);
}
