import http from "node:http";

const rateLimitBuckets = new Map();

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function createHandler(upstream) {
  return (req, res) => {
    if (req.url === "/health") {
      sendJson(res, 200, { upstream, status: "ok" });
      return;
    }

    if (
      upstream === "server" &&
      (req.url === "/api/notifications/stream" ||
        req.url === "/api/agent/smoke")
    ) {
      res.writeHead(200, {
        "cache-control": "no-cache",
        "content-type": "text/event-stream",
      });
      res.flushHeaders();
      res.write("event: message\ndata: first\n\n");

      const finishTimer = setTimeout(() => {
        res.end("event: message\ndata: second\n\n");
      }, 2_000);
      res.on("close", () => clearTimeout(finishTimer));
      return;
    }

    if (upstream === "server" && req.url === "/api/upload") {
      let bodyBytes = 0;
      req.on("data", (chunk) => {
        bodyBytes += chunk.length;
      });
      req.on("end", () => {
        sendJson(res, 200, { bodyBytes, upstream });
      });
      return;
    }

    if (upstream === "server" && req.url === "/api/limited") {
      const clientIp = req.headers["x-forwarded-for"] ?? "unknown";
      const count = (rateLimitBuckets.get(clientIp) ?? 0) + 1;
      rateLimitBuckets.set(clientIp, count);
      sendJson(res, count > 1 ? 429 : 200, { clientIp, count, upstream });
      return;
    }

    sendJson(res, 200, {
      headers: req.headers,
      remoteAddress: req.socket.remoteAddress,
      upstream,
    });
  };
}

const client = http.createServer(createHandler("client"));
const server = http.createServer(createHandler("server"));

client.listen(3000, "0.0.0.0");
server.listen(4000, "0.0.0.0");

function shutdown() {
  client.close();
  server.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
