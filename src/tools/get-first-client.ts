import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { ClientFull } from "../client/types.js";
import { formatClient } from "../formatters/client-formatter.js";

export const getFirstClientSchema = {};

export function registerGetFirstClient(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_first_client",
    [
      "Return the authenticated user's default traveler — the first client (tourist) accessible under their account, with full passport documents, nationality, and loyalty memberships.",
      "",
      "Behavior depends on the role from get_current_user:",
      "",
      "  • role = 'employee_traveller' (Тревелер): the API is guaranteed to return the ONLY tourist this user has access to (themselves). Always call this before the first search — silently, without asking. Use the returned nationality for search and reuse the same tourist at create_order.",
      "",
      "  • Any other role:",
      "      - Hotel search for 1 adult with no supplied nationality — call this BEFORE search_hotels and propose: 'Use Ivan Petrov, BY? Or specify a different nationality?'. If accepted, reuse the same client at booking.",
      "      - Single-guest flight booking — call BEFORE create_order to offer the user's own profile and avoid retyping passport details.",
      "      - Do NOT call for multi-guest bookings (2+ adults) — ask only for the lead guest's nationality and collect each traveler's details before create_order.",
      "      - If the user rejects the suggested traveler, fall through to search_clients or collect details manually.",
    ].join("\n"),
    getFirstClientSchema,
    async () => {
      try {
        const data = await client.get<ClientFull>("/clients");
        return {
          content: [{ type: "text", text: formatClient(data) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting default client: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
