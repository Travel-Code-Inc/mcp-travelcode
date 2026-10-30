import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { AssignTravelPolicyResponse } from "../client/types.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";
import { formatAssignTravelPolicyResult, formatAssignConflicts } from "../formatters/assign-policy-formatter.js";
import { DESTRUCTIVE_WRITE_TOOL } from "../util/tool-annotations.js";

export const assignTravelPolicySchema = {
  userIds: z
    .array(z.number().int().positive())
    .min(1)
    .max(500)
    .describe("Employee ids to assign the policy to (max 500 per call)."),
  policyId: z.number().int().positive().describe("Travel policy id to assign (from list_travel_policies)."),
  confirmReplace: z
    .boolean()
    .optional()
    .describe(
      "Leave unset on the first call. If the result reports employees who already have a different personal policy, show that list to the user; only after the user explicitly agrees, call again with confirmReplace=true to overwrite those personal policies.",
    ),
};

export function registerAssignTravelPolicy(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "assign_travel_policy",
    [
      "Assign a travel policy personally to one or more employees. Safe by design: the first call only checks for conflicts — if some of the employees already have a different personal policy, nothing is changed and the tool returns that list so the user can decide. Call again with confirmReplace=true only after the user explicitly agrees to overwrite those personal policies.",
      "",
      "USER-FACING LANGUAGE: speak about 'assigning a policy', 'employees who already have their own policy'. Never quote internal labels, REST routes, or raw field names.",
      "",
      "Notes:",
      "  • Policies that apply to whole departments or roles cannot be assigned this way — manage them via the policy itself.",
      "  • Available to directors and travel managers (also account admins/editors).",
    ].join("\n"),
    { ...assignTravelPolicySchema, ...impersonationInputSchema },
    DESTRUCTIVE_WRITE_TOOL,
    withImpersonation(
      async ({
        userIds,
        policyId,
        confirmReplace,
      }: {
        userIds: number[];
        policyId: number;
        confirmReplace?: boolean;
      }) => {
        try {
          const dryRun = await client.post<AssignTravelPolicyResponse>("/users/travel-policy", {
            userIds,
            policyId,
            dryRun: true,
          });
          const conflicts = dryRun.conflicts ?? [];

          if (conflicts.length > 0 && confirmReplace !== true) {
            return {
              content: [{ type: "text" as const, text: formatAssignConflicts(conflicts, userIds.length) }],
            };
          }

          const body: Record<string, unknown> = { userIds, policyId };
          if (conflicts.length > 0) {
            body.replacePersonalFor = conflicts.map((c) => c.id);
          }
          const result = await client.post<AssignTravelPolicyResponse>("/users/travel-policy", body);
          return {
            content: [{ type: "text" as const, text: formatAssignTravelPolicyResult(result) }],
          };
        } catch (error) {
          return {
            content: [{ type: "text" as const, text: `Error assigning travel policy: ${(error as Error).message}` }],
            isError: true,
          };
        }
      },
    ),
  );
}
