import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { TravelerDetailResponse } from "../client/types.js";
import { formatTraveler } from "../formatters/traveler-formatter.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";

export const getTravelerSchema = {
  id: z
    .string()
    .min(1)
    .describe("Traveler public ID. Format 'oc-<int>' (e.g. 'oc-12345') or a raw integer string — both accepted."),
};

export function getTravelerHandler(client: TravelCodeApiClient) {
  return withImpersonation(async ({ id }: { id: string }) => {
    try {
      const data = await client.get<TravelerDetailResponse>(`/travelers/${encodeURIComponent(id)}`);
      return {
        content: [{ type: "text" as const, text: formatTraveler(data) }],
      };
    } catch (error) {
      return {
        content: [
          { type: "text" as const, text: `Error getting traveler ${id}: ${(error as Error).message}` },
        ],
        isError: true,
      };
    }
  });
}

export function registerGetTraveler(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_traveler",
    "Get full details of a single traveler — passport, nationality, current trip with services (hotels, flights). Typical flow: search_travelers → pick a person → this tool. Speak in plain language ('this traveler', 'their passport'); never quote internal labels, REST routes, or error codes.",
    { ...getTravelerSchema, ...impersonationInputSchema },
    getTravelerHandler(client),
  );
}
