import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { ClientShort } from "../client/types.js";
import { formatClientList } from "../formatters/client-formatter.js";

export const searchClientsSchema = {
  first_name: z.string().optional().describe("First name to match (partial, case-insensitive, matches both Cyrillic and Latin fields)"),
  last_name: z.string().optional().describe("Last name to match (partial, case-insensitive, matches both Cyrillic and Latin fields)"),
};

export function registerSearchClients(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "search_clients",
    [
      "Find existing clients (tourists) by first name and/or last name. Returns up to 50 short results — call get_client(id) afterwards to pull passport docs and memberships before create_order.",
      "",
      "When to call:",
      "  • Multi-guest bookings — once per named traveler the user mentions.",
      "  • The user explicitly wants 'someone other than me' (i.e. rejected get_first_client).",
      "  • The user mentions a name and you suspect that tourist is already on file (avoids creating a duplicate client during create_order).",
      "",
      "Note: matching is partial (LIKE) and works against both Cyrillic and Latin name fields. At least one of first_name / last_name is required.",
    ].join("\n"),
    searchClientsSchema,
    async ({ first_name, last_name }) => {
      if (!first_name && !last_name) {
        return {
          content: [{ type: "text", text: "Provide first_name or last_name (or both) to search." }],
          isError: true,
        };
      }
      try {
        const data = await client.get<ClientShort[]>("/clients/search", {
          firstName: first_name,
          lastName: last_name,
        });
        return {
          content: [{ type: "text", text: formatClientList(data) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error searching clients: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
