/**
 * GitHub webhook receiver — listens on 127.0.0.1 only, nginx proxies
 * /webhooks/github here. Verifies HMAC-SHA256 against WEBHOOK_SECRET,
 * filters to push events on the configured ref, and spawns deploy.sh
 * detached so the receiver responds immediately.
 *
 * Intentionally zero npm dependencies — small attack surface.
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";

const PORT = parseInt(process.env.WEBHOOK_PORT || "3001", 10);
const SECRET = process.env.WEBHOOK_SECRET;
const DEPLOY_SCRIPT = process.env.WEBHOOK_DEPLOY_SCRIPT || "/opt/mcp-travelcode/bin/deploy.sh";
const ALLOWED_REF = process.env.WEBHOOK_REF || "refs/heads/main";
const MAX_BODY = 1_000_000;

if (!SECRET) {
  console.error("WEBHOOK_SECRET not set; refusing to start");
  process.exit(1);
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (c: Buffer) => {
      total += c.length;
      if (total > MAX_BODY) {
        req.destroy();
        reject(new Error("body too large"));
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verifySignature(secret: string, body: Buffer, headerSig: string | undefined): boolean {
  if (!headerSig || !headerSig.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(headerSig);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function reply(res: ServerResponse, status: number, message: string): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: status < 400, message }));
}

const server = createServer(async (req, res) => {
  const url = req.url || "";

  if (req.method === "GET" && url === "/health") {
    reply(res, 200, "ok");
    return;
  }

  if (req.method !== "POST" || url !== "/webhooks/github") {
    reply(res, 404, "not found");
    return;
  }

  let body: Buffer;
  try {
    body = await readBody(req);
  } catch {
    reply(res, 413, "payload too large");
    return;
  }

  const sigHeader = req.headers["x-hub-signature-256"] as string | undefined;
  if (!verifySignature(SECRET as string, body, sigHeader)) {
    console.warn(`[webhook] invalid signature from ${req.socket.remoteAddress}`);
    reply(res, 401, "invalid signature");
    return;
  }

  const event = req.headers["x-github-event"] as string | undefined;

  if (event === "ping") {
    console.log("[webhook] ping received");
    reply(res, 200, "pong");
    return;
  }

  if (event !== "push") {
    reply(res, 204, `event ${event} ignored`);
    return;
  }

  let payload: { ref?: string; after?: string; repository?: { full_name?: string } };
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    reply(res, 400, "invalid json");
    return;
  }

  if (payload.ref !== ALLOWED_REF) {
    console.log(`[webhook] ignoring push to ${payload.ref}`);
    reply(res, 204, "ref ignored");
    return;
  }

  console.log(
    `[webhook] deploy trigger ${payload.repository?.full_name ?? "?"} ${payload.after ?? "?"}`,
  );
  const child = spawn(DEPLOY_SCRIPT, [], {
    detached: true,
    stdio: "ignore",
    cwd: "/opt/mcp-travelcode",
  });
  child.unref();

  reply(res, 202, "deploy triggered");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`webhook listening on 127.0.0.1:${PORT}, ref=${ALLOWED_REF}`);
});

function shutdown(sig: string): void {
  console.log(`received ${sig}, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
