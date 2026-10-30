import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { TravelPolicyFull } from "../client/types.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";
import { formatTravelPolicyFull } from "../formatters/travel-policy-formatter.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const getTravelPolicySchema = {
  id: z.number().int().positive().describe("Travel policy id (from list_travel_policies)."),
};

export function registerGetTravelPolicy(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_travel_policy",
    [
      "Show one travel policy in full: spending limits per service type (flights, hotels, railway, transfers), city-specific limit overrides, cabin/star/refundability restrictions, advance-booking rules, how out-of-policy bookings are handled (blocked, shown, or sent for approval), the number of approvers, and exactly who the policy covers.",
      "",
      "USER-FACING LANGUAGE: speak about 'limits', 'out-of-policy handling', 'approvers', 'who the policy applies to'. Never quote internal labels, REST routes, or raw field names.",
      "",
      "Available to directors and travel managers (also account admins/editors).",
    ].join("\n"),
    { ...getTravelPolicySchema, ...impersonationInputSchema },
    READ_ONLY_TOOL,
    withImpersonation(async ({ id }: { id: number }) => {
      try {
        const data = await client.get<TravelPolicyFull>(`/travel-policies/${id}`);
        return {
          content: [{ type: "text" as const, text: formatTravelPolicyFull(data) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching travel policy: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }),
  );
}
