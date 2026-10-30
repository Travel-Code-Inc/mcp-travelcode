import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { EmployeeDetail } from "../client/types.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";
import { formatEmployeeDetail } from "../formatters/employee-formatter.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const getEmployeeSchema = {
  id: z.number().int().positive().describe("Employee id (from search_employees)."),
};

export function registerGetEmployee(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_employee",
    [
      "Show one employee's card: name, contacts, role, company, department, account status, and the travel policy that actually applies to them — with the reason it applies (assigned personally, inherited from their department, or from their role).",
      "",
      "USER-FACING LANGUAGE: speak about 'the employee', 'their travel policy and where it comes from'. Never quote internal labels, REST routes, or raw field names.",
      "",
      "Available to directors and travel managers (also account admins/editors); only employees of the caller's own companies are visible.",
    ].join("\n"),
    { ...getEmployeeSchema, ...impersonationInputSchema },
    READ_ONLY_TOOL,
    withImpersonation(async ({ id }: { id: number }) => {
      try {
        const data = await client.get<EmployeeDetail>(`/users/${id}`);
        return {
          content: [{ type: "text" as const, text: formatEmployeeDetail(data) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching employee: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }),
  );
}
