import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { DepartmentsResponse } from "../client/types.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";
import { formatDepartmentTree } from "../formatters/department-formatter.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const listDepartmentsSchema = {
  companyId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Legal-entity company id. Omit to use the currently active company of the authenticated user."),
};

export function registerListDepartments(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "list_departments",
    [
      "Show the department tree of a company: nested departments with member counts (direct and including sub-departments), department admins, and how many employees are not assigned to any department yet.",
      "",
      "USER-FACING LANGUAGE: speak about 'departments', 'teams', 'department admins'. Never quote internal labels or REST routes.",
      "",
      "Use the department ids from this tree when moving employees between departments or reading department-scoped travel policies.",
    ].join("\n"),
    { ...listDepartmentsSchema, ...impersonationInputSchema },
    READ_ONLY_TOOL,
    withImpersonation(async ({ companyId }: { companyId?: number }) => {
      try {
        const path = companyId ? `/companies/${companyId}/departments` : "/companies/departments";
        const data = await client.get<DepartmentsResponse>(path);
        return {
          content: [{ type: "text" as const, text: formatDepartmentTree(data) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error listing departments: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }),
  );
}
