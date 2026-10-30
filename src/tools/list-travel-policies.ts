import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { TravelPoliciesResponse } from "../client/types.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";
import { formatTravelPolicyList } from "../formatters/travel-policy-formatter.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const listTravelPoliciesSchema = {
  companyId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Limit the list to policies bound to one legal-entity company. Omit to see all policies of the account."),
  q: z
    .string()
    .optional()
    .describe("Filter policies by name (substring match)."),
};

export function registerListTravelPolicies(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "list_travel_policies",
    [
      "List the corporate travel policies of the account: name, which company each policy is bound to, who it applies to (personal users, departments, roles), and a short summary of the flight/hotel/railway/transfer rules. Pair with get_travel_policy for the full rule breakdown.",
      "",
      "USER-FACING LANGUAGE: speak about 'travel policies', 'spending rules', 'who the policy covers'. Never quote internal labels, REST routes, or raw field names.",
      "",
      "Available to directors and travel managers (also account admins/editors). The list is not paginated — all policies come back at once.",
    ].join("\n"),
    { ...listTravelPoliciesSchema, ...impersonationInputSchema },
    READ_ONLY_TOOL,
    withImpersonation(async ({ companyId, q }: { companyId?: number; q?: string }) => {
      try {
        const data = await client.get<TravelPoliciesResponse>("/travel-policies", {
          agencyId: companyId,
          q,
        });
        return {
          content: [{ type: "text" as const, text: formatTravelPolicyList(data) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error listing travel policies: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }),
  );
}
