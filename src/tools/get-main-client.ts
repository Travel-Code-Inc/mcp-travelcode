import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { ClientFull } from "../client/types.js";
import { formatClient } from "../formatters/client-formatter.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";

export const getMainClientSchema = {};

export function registerGetMainClient(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_main_client",
    [
      "Return the user's main saved traveler — name, nationality, passport(s), loyalty memberships.",
      "",
      "USER-FACING LANGUAGE: speak about 'your saved profile', 'your traveler', 'use Ivan, Belarusian?'. Never quote internal labels, REST routes, or error codes.",
      "",
      "When to call:",
      "  • Traveller role (employee_traveller): always, silently, before the first search. Reuse the returned traveler everywhere.",
      "  • Other roles, 1-adult hotel search with no nationality given — call before search_hotels and propose the saved traveler. If the user accepts, reuse them at booking.",
      "  • Other roles, single-guest flight booking — call before create_order to offer the saved profile and avoid retyping passport details.",
      "  • Do NOT call for 2+ adults — ask only the lead guest's nationality and collect each traveler's details before booking.",
      "  • If the user rejects the proposed traveler, fall through to search_clients or collect details manually.",
    ].join("\n"),
    { ...getMainClientSchema, ...impersonationInputSchema },
    withImpersonation(async () => {
      try {
        const data = await client.get<ClientFull>("/clients");
        return {
          content: [{ type: "text", text: formatClient(data) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting main client: ${(error as Error).message}` }],
          isError: true,
        };
      }
    })
  );
}
