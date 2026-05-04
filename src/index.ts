#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

async function main() {
  const config = await loadConfig();
  const { server } = createServer(config);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("TravelCode MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
