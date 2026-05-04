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
      "Look up saved travelers by first and/or last name. Returns up to 50 short matches — afterwards call get_client(id) to pull full passport docs and memberships before booking.",
      "",
      "USER-FACING LANGUAGE: speak about 'saved travelers', 'your contacts', 'this person', 'their passport'. Never quote internal labels, REST routes, error codes, or numeric ids.",
      "",
      "When to call:",
      "  • Multi-guest bookings — once per named traveler the user mentions.",
      "  • The user explicitly wants someone other than themselves (rejected the proposed main traveler).",
      "  • The user mentions a name and you suspect that traveler is already on file (avoids creating a duplicate during booking).",
      "",
      "Matching is partial and works against both Cyrillic and Latin name fields. At least one of first_name or last_name is required.",
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
