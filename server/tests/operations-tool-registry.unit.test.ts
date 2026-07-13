import {
  JobStatus,
  MembershipRole,
  ToolInvocationSource,
  ToolInvocationStatus,
} from "@prisma/client";
import { z } from "zod";
import type { AuthContext } from "../src/types/auth";
import { OpsFlowToolRegistry } from "../src/modules/operations-tools";

function buildAuth(role: MembershipRole): AuthContext {
  return {
    userId: "user-1",
    sessionId: "session-1",
    tenantId: "tenant-1",
    role,
  };
}

function buildTool() {
  return {
    name: "example_tool",
    title: "Example tool",
    description: "A test tool.",
    audiences: ["web-agent" as const],
    allowedRoles: [MembershipRole.MANAGER],
    inputSchema: z.object({ value: z.string() }).strict(),
    outputSchema: z.object({ value: z.string() }),
    annotations: {
      readOnly: true,
      destructive: false,
      idempotent: true,
      openWorld: false,
    },
    execute: vi.fn(async (_auth, input: { value: string }) => input),
  };
}

describe("OpsFlowToolRegistry", () => {
  it("lists tools only for allowed audiences and roles", () => {
    const registry = new OpsFlowToolRegistry();
    registry.register(buildTool());

    expect(
      registry.list({
        auth: buildAuth(MembershipRole.MANAGER),
        audience: "web-agent",
      }),
    ).toHaveLength(1);
    expect(
      registry.list({
        auth: buildAuth(MembershipRole.STAFF),
        audience: "web-agent",
      }),
    ).toHaveLength(0);
    expect(
      registry.list({
        auth: buildAuth(MembershipRole.MANAGER),
        audience: "external-mcp",
      }),
    ).toHaveLength(0);
  });

  it("validates input and output around execution", async () => {
    const registry = new OpsFlowToolRegistry();
    const tool = buildTool();
    registry.register(tool);

    const invalidInput = await registry.execute({
      auth: buildAuth(MembershipRole.MANAGER),
      audience: "web-agent",
      toolName: tool.name,
      arguments: { value: 1 },
      context: { source: "WEB_AGENT", invocationId: "invocation-1" },
    });

    expect(invalidInput).toEqual(
      expect.objectContaining({
        error: true,
        code: "TOOL_INPUT_VALIDATION_FAILED",
      }),
    );
    expect(tool.execute).not.toHaveBeenCalled();

    tool.execute.mockResolvedValueOnce({ value: 1 } as never);
    const invalidOutput = await registry.execute({
      auth: buildAuth(MembershipRole.MANAGER),
      audience: "web-agent",
      toolName: tool.name,
      arguments: { value: "ok" },
      context: { source: "WEB_AGENT", invocationId: "invocation-2" },
    });

    expect(invalidOutput).toEqual(
      expect.objectContaining({
        error: true,
        code: "TOOL_OUTPUT_VALIDATION_FAILED",
      }),
    );
  });

  it("rejects direct calls that bypass list filtering", async () => {
    const registry = new OpsFlowToolRegistry();
    registry.register(buildTool());

    const result = await registry.execute({
      auth: buildAuth(MembershipRole.STAFF),
      audience: "web-agent",
      toolName: "example_tool",
      arguments: { value: "blocked" },
      context: { source: "WEB_AGENT", invocationId: "invocation-3" },
    });

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        code: "TOOL_PERMISSION_DENIED",
      }),
    );
  });

  it("rejects direct calls from an audience the tool does not expose", async () => {
    const registry = new OpsFlowToolRegistry();
    registry.register(buildTool());

    const result = await registry.execute({
      auth: buildAuth(MembershipRole.MANAGER),
      audience: "external-mcp",
      toolName: "example_tool",
      arguments: { value: "blocked" },
      context: { source: "MCP", invocationId: "invocation-audience" },
    });

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        code: "TOOL_PERMISSION_DENIED",
      }),
    );
  });

  it("supports strongly typed enum output schemas", async () => {
    const registry = new OpsFlowToolRegistry();
    registry.register({
      ...buildTool(),
      name: "status_tool",
      outputSchema: z.object({ status: z.nativeEnum(JobStatus) }),
      execute: async () => ({ status: JobStatus.NEW }),
    });

    await expect(
      registry.execute({
        auth: buildAuth(MembershipRole.MANAGER),
        audience: "web-agent",
        toolName: "status_tool",
        arguments: { value: "ok" },
        context: { source: "WEB_AGENT", invocationId: "invocation-4" },
      }),
    ).resolves.toEqual({ status: JobStatus.NEW });
  });

  it("records only structural metadata for successful invocations", async () => {
    const recordInvocation = vi.fn(async () => {});
    const registry = new OpsFlowToolRegistry({ recordInvocation });
    registry.register(buildTool());

    await registry.execute({
      auth: buildAuth(MembershipRole.MANAGER),
      audience: "web-agent",
      toolName: "example_tool",
      arguments: { value: "private customer details" },
      context: {
        source: "WEB_AGENT",
        invocationId: "invocation-audit",
        requestId: "request-1",
        conversationId: "conversation-1",
      },
    });

    expect(recordInvocation).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      userId: "user-1",
      source: ToolInvocationSource.WEB_AGENT,
      invocationId: "invocation-audit",
      requestId: "request-1",
      conversationId: "conversation-1",
      toolName: "example_tool",
      status: ToolInvocationStatus.SUCCEEDED,
      durationMs: expect.any(Number),
      errorCode: undefined,
      proposalId: undefined,
      inputKeys: ["value"],
      outputKeys: ["value"],
    });
    expect(JSON.stringify(recordInvocation.mock.calls)).not.toContain(
      "private customer details",
    );
  });

  it("audits rejected input without storing attacker-controlled values or keys", async () => {
    const recordInvocation = vi.fn(async () => {});
    const registry = new OpsFlowToolRegistry({ recordInvocation });
    registry.register(buildTool());

    await registry.execute({
      auth: buildAuth(MembershipRole.MANAGER),
      audience: "web-agent",
      toolName: "example_tool",
      arguments: { "private@example.com": "secret" },
      context: {
        source: "WEB_AGENT",
        invocationId: "invocation-invalid",
      },
    });

    expect(recordInvocation).toHaveBeenCalledWith(
      expect.objectContaining({
        source: ToolInvocationSource.WEB_AGENT,
        status: ToolInvocationStatus.FAILED,
        errorCode: "TOOL_INPUT_VALIDATION_FAILED",
        inputKeys: [],
        outputKeys: [],
      }),
    );
    expect(JSON.stringify(recordInvocation.mock.calls)).not.toContain("private@example.com");
    expect(JSON.stringify(recordInvocation.mock.calls)).not.toContain("secret");
  });
});
