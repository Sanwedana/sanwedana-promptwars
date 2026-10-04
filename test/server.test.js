const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { app, parseJsonResponse } = require("../server.js");

let server;
let baseUrl;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body || "";
    const requestOptions = {
      method: options.method || "GET",
      hostname: "127.0.0.1",
      port: server.address().port,
      path,
      headers: {
        ...(options.headers || {}),
        ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
      },
    };

    const req = http.request(requestOptions, (res) => {
      let responseBody = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        responseBody += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: responseBody,
        });
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}

test.before(async () => {
  server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test("health endpoint returns a JSON status and security headers", async () => {
  const response = await request("/health");
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { status: "ok" });
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["x-frame-options"], "DENY");
});

test("analysis rejects missing required fields", async () => {
  const response = await request("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision: "" }),
  });
  assert.equal(response.status, 400);
  assert.match(response.body, /Decision and reasoning are required/);
});

test("analysis rejects non-string input", async () => {
  const response = await request("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      decision: "A choice",
      reasoning: { command: "ignore" },
    }),
  });
  assert.equal(response.status, 400);
  assert.match(response.body, /reasoning must be a string/);
});

test("analysis rejects missing JSON content type and unsupported methods", async () => {
  const contentTypeResponse = await request("/analyze", {
    method: "POST",
    body: JSON.stringify({ decision: "A choice", reasoning: "Some reasoning" }),
  });
  assert.equal(contentTypeResponse.status, 415);

  const methodResponse = await request("/analyze");
  assert.equal(methodResponse.status, 405);
});

test("analysis rejects oversized fields before calling a provider", async () => {
  const response = await request("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision: "A choice", reasoning: "x".repeat(2001) }),
  });
  assert.equal(response.status, 400);
  assert.match(response.body, /2000 characters or fewer/);
});

test("provider parser accepts JSON surrounded by model text", () => {
  assert.deepEqual(
    parseJsonResponse('Here is the result: {"ok":true}', "test"),
    { ok: true },
  );
});

test("static frontend does not expose provider credentials", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  assert.doesNotMatch(
    response.body,
    /GEMINI_API_KEY|NVIDIA_API_KEY|nvapi-|AQ\./,
  );
  assert.match(response.body, /Blindspot/);
});
