import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { performance } from "node:perf_hooks";

const baseUrl = new URL(process.env.NGINX_BASE_URL ?? "http://nginx");
const appHost = "app.opsflow.test";
const apiHost = "api.opsflow.test";
const tenMiB = 10 * 1024 * 1024;

function request({ body, headers = {}, host, method = "GET", path }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        headers: { Host: host, ...headers },
        hostname: baseUrl.hostname,
        method,
        path,
        port: baseUrl.port || 80,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            body: Buffer.concat(chunks),
            headers: res.headers,
            statusCode: res.statusCode,
          });
        });
      },
    );

    req.setTimeout(5_000, () => req.destroy(new Error("Request timed out.")));
    req.on("error", reject);
    req.end(body);
  });
}

function parseJson(response) {
  return JSON.parse(response.body.toString("utf8"));
}

async function waitForNginx() {
  let lastError;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await request({ host: appHost, path: "/health" });
      if (response.statusCode === 200) return;
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw lastError ?? new Error("Nginx did not become ready.");
}

async function verifyRoutesAndForwardedHeaders() {
  const appResponse = await request({ host: appHost, path: "/" });
  assert.equal(appResponse.statusCode, 200);
  assert.equal(parseJson(appResponse).upstream, "client");

  const apiResponse = await request({
    headers: { "X-Forwarded-For": "203.0.113.9, 198.51.100.7" },
    host: apiHost,
    path: "/api/headers",
  });
  assert.equal(apiResponse.statusCode, 200);

  const payload = parseJson(apiResponse);
  assert.equal(payload.upstream, "server");
  assert.equal(payload.headers["x-forwarded-for"], payload.headers["x-real-ip"]);
  assert.equal(payload.headers["x-forwarded-proto"], "http");
  assert.equal(payload.headers["x-forwarded-for"].includes(","), false);
  assert.equal(payload.headers["x-forwarded-for"].includes("203.0.113.9"), false);
  assert.equal(payload.headers["x-forwarded-for"].includes("198.51.100.7"), false);
}

async function verifySpoofResistantRateLimitKey() {
  const first = await request({
    headers: { "X-Forwarded-For": "198.51.100.10" },
    host: apiHost,
    path: "/api/limited",
  });
  assert.equal(first.statusCode, 200);

  const second = await request({
    headers: { "X-Forwarded-For": "203.0.113.20" },
    host: apiHost,
    path: "/api/limited",
  });
  assert.equal(second.statusCode, 429);
  assert.equal(parseJson(second).clientIp, parseJson(first).clientIp);
}

function createMultipartBody(fileSize) {
  const boundary = "opsflow-nginx-smoke-boundary";
  const prefix = Buffer.from(
    `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="file"; filename="evidence.bin"\r\n' +
      "Content-Type: application/octet-stream\r\n\r\n",
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);

  return {
    body: Buffer.concat([prefix, Buffer.alloc(fileSize, 97), suffix]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function verifyUploadBoundary() {
  const upload = createMultipartBody(tenMiB);
  const accepted = await request({
    body: upload.body,
    headers: {
      "Content-Length": String(upload.body.length),
      "Content-Type": upload.contentType,
    },
    host: apiHost,
    method: "POST",
    path: "/api/upload",
  });

  assert.equal(accepted.statusCode, 200);
  assert.equal(parseJson(accepted).bodyBytes, upload.body.length);
  assert.ok(upload.body.length > tenMiB, "multipart envelope should be counted");

  const rejected = await request({
    body: Buffer.alloc(12 * 1024 * 1024, 98),
    headers: {
      "Content-Length": String(12 * 1024 * 1024),
      "Content-Type": "application/octet-stream",
    },
    host: apiHost,
    method: "POST",
    path: "/api/upload",
  });
  assert.equal(rejected.statusCode, 413);
}

function verifySseRoute(path) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    let settled = false;
    const req = http.request(
      {
        headers: { Host: apiHost },
        hostname: baseUrl.hostname,
        path,
        port: baseUrl.port || 80,
      },
      (res) => {
        try {
          assert.equal(res.statusCode, 200);
          assert.equal(res.headers["x-accel-buffering"], "no");
        } catch (error) {
          settled = true;
          reject(error);
          res.destroy();
          return;
        }

        let received = "";
        res.on("data", (chunk) => {
          if (settled) return;
          received += chunk.toString("utf8");
          if (!received.includes("data: first")) return;

          try {
            assert.ok(
              performance.now() - startedAt < 1_250,
              `${path} buffered the first SSE event`,
            );
            settled = true;
            resolve();
            res.destroy();
          } catch (error) {
            settled = true;
            reject(error);
            res.destroy();
          }
        });
        res.on("end", () => {
          if (!settled) reject(new Error(`${path} ended before its first event.`));
        });
      },
    );

    req.setTimeout(1_500, () => {
      if (settled) return;
      settled = true;
      req.destroy(new Error(`${path} did not stream promptly.`));
    });
    req.on("error", (error) => {
      if (!settled) reject(error);
    });
    req.end();
  });
}

async function verifySharedProductionConfig() {
  const configDir = new URL("./config/", import.meta.url);
  const [bootstrap, ssl, proxyHeaders, proxySse, entrypoint] = await Promise.all(
    [
      "bootstrap.conf.template",
      "ssl.conf.template",
      "proxy-headers.conf",
      "proxy-sse.conf",
      "docker-entrypoint.sh",
    ].map((file) => readFile(new URL(file, configDir), "utf8")),
  );

  for (const template of [bootstrap, ssl]) {
    assert.match(
      template,
      /client_max_body_size \$\{EVIDENCE_REQUEST_MAX_SIZE_BYTES\};/,
    );
    assert.equal(
      template.match(/include \/etc\/nginx\/snippets\/proxy-headers\.conf;/g)
        ?.length,
      4,
    );
    assert.equal(
      template.match(/include \/etc\/nginx\/snippets\/proxy-sse\.conf;/g)
        ?.length,
      2,
    );
  }

  assert.match(proxyHeaders, /X-Forwarded-For \$remote_addr;/);
  assert.doesNotMatch(proxyHeaders, /proxy_add_x_forwarded_for/);
  assert.match(proxySse, /proxy_buffering off;/);
  assert.match(proxySse, /X-Accel-Buffering no;/);
  assert.match(entrypoint, /EVIDENCE_MAX_SIZE_BYTES \+ 1048576/);
  assert.doesNotMatch(ssl, /listen [^;]*http2/);
  assert.equal(ssl.match(/http2 on;/g)?.length, 2);
}

await waitForNginx();
await verifyRoutesAndForwardedHeaders();
await verifySpoofResistantRateLimitKey();
await verifyUploadBoundary();
await Promise.all([
  verifySseRoute("/api/agent/smoke"),
  verifySseRoute("/api/notifications/stream"),
]);
await verifySharedProductionConfig();

console.log(
  "Nginx ingress smoke passed: routing, forwarded IPs, rate limiting, upload size, and SSE.",
);
