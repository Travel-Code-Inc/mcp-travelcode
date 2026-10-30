import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { DepartmentMembersResponse } from "../client/types.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";
import { DESTRUCTIVE_WRITE_TOOL } from "../util/tool-annotations.js";

export const moveEmployeeToDepartmentSchema = {
  userIds: z
    .array(z.number().int().positive())
    .min(1)
    .describe("Employee ids to add to (or move into) the department."),
  companyId: z.number().int().positive().describe("Legal-entity company id the department belongs to."),
  departmentId: z.number().int().positive().describe("Target department id (from list_departments)."),
};

export function registerMoveEmployeeToDepartment(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "move_employee_to_department",
    [
      "Add one or more employees to a department (an employee already in another department is moved). If the move changes which travel policy applies to someone, the result says so.",
      "",
      "USER-FACING LANGUAGE: speak about 'moving an employee to a department'. Never quote internal labels, REST routes, or raw field names.",
      "",
      "Employees must belong to the same company as the department. Available to directors and travel managers (also account admins/editors).",
    ].join("\n"),
    { ...moveEmployeeToDepartmentSchema, ...impersonationInputSchema },
    DESTRUCTIVE_WRITE_TOOL,
    withImpersonation(
      async ({
        userIds,
        companyId,
        departmentId,
      }: {
        userIds: number[];
        companyId: number;
        departmentId: number;
      }) => {
        try {
          const data = await client.post<DepartmentMembersResponse | null>(
            `/companies/${companyId}/departments/${departmentId}/members`,
            { userIds },
          );
          const lines: string[] = [
            `${userIds.length} employee(s) moved to the department.`,
          ];
          const changed = data?.policyChangedUserIds ?? [];
          if (changed.length > 0) {
            lines.push(
              `The applicable travel policy changed for ${changed.length} of them: ${changed.map((id) => `#${id}`).join(", ")}.`,
            );
          }
          if (data?.approvals) {
            lines.push("Note: some pending trip approvals were reset because the applicable policy changed.");
          }
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        } catch (error) {
          return {
            content: [{ type: "text" as const, text: `Error moving employee(s) to department: ${(error as Error).message}` }],
            isError: true,
          };
        }
      },
    ),
  );
}
