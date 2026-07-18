import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  resolveAuthContextFromAccessToken,
  revalidateTenantAuthContext,
} from "../auth/auth-context";
import { createConversation } from "../agent/agent.service";
import { createOpsFlowMcpServer } from "./mcp-server";

export async function resolveMcpAuthContextFromAccessToken(
  accessToken: string,
) {
  const auth = await resolveAuthContextFromAccessToken(accessToken);
  return revalidateTenantAuthContext(auth);
}

export async function startStdioMcpServer() {
  const accessToken = process.env.OPSFLOW_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error("OPSFLOW_ACCESS_TOKEN is required to start the MCP server.");
  }

  const resolveAuth = () => resolveMcpAuthContextFromAccessToken(accessToken);
  const auth = await resolveAuth();
  let conversationIdPromise: Promise<string> | undefined;
  const getConversationId = () => {
    conversationIdPromise ??= createConversation(auth).then(
      (conversation) => conversation.id,
    );
    return conversationIdPromise;
  };

  const server = createOpsFlowMcpServer({
    auth,
    resolveAuth,
    getConversationId,
  });
  await server.connect(new StdioServerTransport());
  console.error("OpsFlow local MCP server connected over stdio.");

  return server;
}

if (require.main === module) {
  void startStdioMcpServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown startup error.";
    console.error(`OpsFlow MCP startup failed: ${message}`);
    process.exitCode = 1;
  });
}
