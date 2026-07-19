import { createServer } from "node:http";
import { app } from "./app";
import { env } from "./config/env";
import { startDemoWorkspaceCleanupScheduler } from "./modules/demo-workspace/demo-workspace.service";

const server = createServer(app);
const stopDemoWorkspaceCleanup = startDemoWorkspaceCleanupScheduler();

server.listen(env.PORT, () => {
  console.log(`OpsFlow API listening on http://localhost:${env.PORT}`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully.`);
  stopDemoWorkspaceCleanup();

  server.close((error) => {
    if (error) {
      console.error("Failed to close server cleanly.", error);
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
