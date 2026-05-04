import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { ClientFull } from "../client/types.js";
import { formatClient } from "../formatters/client-formatter.js";

export const getClientSchema = {
  client_id: z.number().int().describe("Client ID returned by search_clients"),
};

export function registerGetClient(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_client",
    "Get full details for a specific client (tourist) by ID, including passport documents and loyalty memberships needed for create_order. Typical flow: search_clients → pick the right result → this tool to pull docs + memberships → create_order.",
    getClientSchema,
    async ({ client_id }) => {
      try {
        const data = await client.get<ClientFull>(`/clients/${client_id}`);
        return {
          content: [{ type: "text", text: formatClient(data) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting client ${client_id}: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
