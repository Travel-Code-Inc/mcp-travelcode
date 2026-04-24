#!/usr/bin/env node

/**
 * HTTP entry point for the TravelCode MCP Server.
 *
 * Flow (MCP spec 2025-06 / OAuth 2.1 + RFC 9728):
 *  1. Client hits /mcp without Bearer → 401 with
 *     `WWW-Authenticate: Bearer resource_metadata="…/oauth-protected-resource/mcp"`.
 *  2. Client fetches Protected Resource Metadata and learns which Authorization
 *     Server to use (the real upstream — travel-code.com).
 *  3. Client runs the standard PKCE flow against the upstream AS and comes back
 *     with an access token. We forward that token to the TravelCode REST API on
 *     each tool call (per-session config, one McpServer instance per session).
 */

import express from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer } from "./server.js";
import { TravelCodeConfig } from "./config.js";

// --- Configuration ---

const PORT = parseInt(process.env.PORT || "3000", 10);
const API_BASE_URL = (process.env.TRAVELCODE_API_BASE_URL || "https://api.travel-code.com/v1").replace(/\/+$/, "");

// Upstream Authorization Server — where /oauth/authorize, /oauth/token,
// /oauth/register, /oauth/revoke live. We proxy AS discovery from this
// sidecar (see authorizationServerMetadata below) because Claude.ai fetches
// AS metadata from the resource origin rather than following PRM's
// `authorization_servers` field.
const UPSTREAM_AS_ORIGIN = (process.env.OAUTH_ISSUER || "https://travel-code.com").replace(/\/+$/, "");

// Public URL of this MCP server (origin, no path). In production, set to
// https://mcp.travel-code.com. Locally defaults to http://localhost:PORT.
const RESOURCE_URI = (process.env.RESOURCE_URI || `http://localhost:${PORT}`).replace(/\/+$/, "");

const MCP_PATH = "/mcp";
const MCP_RESOURCE_IDENTIFIER = `${RESOURCE_URI}${MCP_PATH}`;

// Path-aware PRM URL per RFC 9728 §3.1.
const PRM_URL = `${RESOURCE_URI}/.well-known/oauth-protected-resource${MCP_PATH}`;

const POLL_INTERVAL_MS = parseInt(process.env.TRAVELCODE_POLL_INTERVAL_MS || "2000", 10);
const POLL_TIMEOUT_MS = parseInt(process.env.TRAVELCODE_POLL_TIMEOUT_MS || "90000", 10);

const SCOPES_SUPPORTED = [
  "flights:search",
  "flights:status",
  "flights:stats",
  "airports:read",
  "airlines:read",
  "orders:read",
  "orders:write",
  "hotels:search",
  "hotels:read",
];

// --- Session store ---

interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  createdAt: number;
}

const sessions = new Map<string, Session>();

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

const sessionSweeper = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      session.transport.close().catch(() => {});
      session.server.close().catch(() => {});
      sessions.delete(id);
    }
  }
}, 30 * 60 * 1000);

// --- Express app ---

const app = express();
app.use(express.json());

// CORS — needed for browser-based MCP clients.
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  next();
});

app.options(/.*/, (_req, res) => {
  res.sendStatus(204);
});

// --- Protected Resource Metadata (RFC 9728) ---
//
// `resource` is the canonical MCP endpoint URL — audience binding (RFC 8707)
// ties tokens to this exact URL. `authorization_servers` points at this
// sidecar rather than the upstream origin, because Claude.ai (and other
// clients still on MCP spec 2025-03) run OAuth discovery against the
// resource server itself and ignore the `authorization_servers` field.
// The AS metadata we serve below forwards clients to the real upstream
// authorize / token / register endpoints.

const protectedResourceMetadata = {
  resource: MCP_RESOURCE_IDENTIFIER,
  authorization_servers: [RESOURCE_URI],
  scopes_supported: SCOPES_SUPPORTED,
  bearer_methods_supported: ["header"],
  resource_name: "TravelCode MCP Server",
};

app.get("/.well-known/oauth-protected-resource/mcp", (_req, res) => {
  res.json(protectedResourceMetadata);
});

// Legacy non-path-suffixed PRM for older clients that don't do path-aware
// discovery per RFC 9728 §3.1.
app.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.json(protectedResourceMetadata);
});

// --- Authorization Server Metadata (RFC 8414) ---
//
// `issuer` matches the URL this metadata is served from (RFC 8414 §3.3).
// The endpoints point at the real upstream AS; the browser and token calls
// go there directly, only discovery is served from the sidecar.
// TravelCode tokens are opaque (not JWTs) so the client has no issuer claim
// to cross-check against — the mismatch with travel-code.com as token origin
// is harmless in practice.

const authorizationServerMetadata = {
  issuer: RESOURCE_URI,
  authorization_endpoint: `${UPSTREAM_AS_ORIGIN}/oauth/authorize`,
  token_endpoint: `${UPSTREAM_AS_ORIGIN}/oauth/token`,
  registration_endpoint: `${UPSTREAM_AS_ORIGIN}/oauth/register`,
  revocation_endpoint: `${UPSTREAM_AS_ORIGIN}/oauth/revoke`,
  scopes_supported: SCOPES_SUPPORTED,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  token_endpoint_auth_methods_supported: ["none"],
  code_challenge_methods_supported: ["S256"],
};

app.get("/.well-known/oauth-authorization-server", (_req, res) => {
  res.json(authorizationServerMetadata);
});

app.get("/.well-known/oauth-authorization-server/mcp", (_req, res) => {
  res.json(authorizationServerMetadata);
});

// --- Health check ---

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    transport: "streamable-http",
    sessions: sessions.size,
  });
});

// --- Helper: send 401 ---

function send401(res: express.Response, description = "Bearer token required"): void {
  res.status(401)
    .set("WWW-Authenticate", `Bearer resource_metadata="${PRM_URL}"`)
    .json({ error: "unauthorized", error_description: description });
}

// --- MCP endpoint ---

app.all("/mcp", async (req: express.Request, res: express.Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    send401(res);
    return;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    send401(res);
    return;
  }

  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      // 401 (not 404) so the client restarts the OAuth flow after a sidecar
      // restart or TTL expiry, instead of giving up on a dead session id.
      send401(res, "Session not found or expired. Please re-authenticate.");
      return;
    }

    await session.transport.handleRequest(req, res, req.body);
    return;
  }

  if (req.method !== "POST") {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Missing Mcp-Session-Id header. Initialize session with POST first." },
    });
    return;
  }

  const config: TravelCodeConfig = {
    apiBaseUrl: API_BASE_URL,
    apiToken: token,
    pollIntervalMs: POLL_INTERVAL_MS,
    pollTimeoutMs: POLL_TIMEOUT_MS,
  };

  const server = createServer(config);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) {
      sessions.delete(sid);
    }
  };

  await server.connect(transport);

  // Handle initialize FIRST — SDK only assigns transport.sessionId while
  // processing the initialize method.
  await transport.handleRequest(req, res, req.body);

  const sid = transport.sessionId;
  if (sid && !sessions.has(sid)) {
    sessions.set(sid, {
      transport,
      server,
      createdAt: Date.now(),
    });
  }
});

// --- Start ---

const httpServer = app.listen(PORT, () => {
  console.log(`TravelCode MCP Server (HTTP) listening on port ${PORT}`);
  console.log(`MCP endpoint:         ${MCP_RESOURCE_IDENTIFIER}`);
  console.log(`Protected Resource:   ${PRM_URL}`);
  console.log(`AS metadata (proxy):  ${RESOURCE_URI}/.well-known/oauth-authorization-server`);
  console.log(`Upstream OAuth:       ${UPSTREAM_AS_ORIGIN}/oauth/{authorize,token,register,revoke}`);
  console.log(`API base URL:         ${API_BASE_URL}`);
  console.log(`Scopes:               ${SCOPES_SUPPORTED.join(", ")}`);
});

// --- Graceful shutdown ---
//
// systemd sends SIGTERM on `systemctl stop/restart`; we close the listener so
// no new connections are accepted, then close each live MCP session. The
// session sweeper is cleared so the process can actually exit.

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal} — shutting down gracefully`);

  clearInterval(sessionSweeper);

  httpServer.close((err) => {
    if (err) console.error("HTTP server close error:", err);
  });

  await Promise.allSettled(
    Array.from(sessions.values()).flatMap((s) => [
      s.transport.close().catch(() => {}),
      s.server.close().catch(() => {}),
    ]),
  );
  sessions.clear();

  // Hard exit after a grace window so systemd doesn't have to SIGKILL.
  setTimeout(() => process.exit(0), 2_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
