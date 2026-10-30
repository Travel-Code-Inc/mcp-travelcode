import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { EmployeesSearchResponse } from "../client/types.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";
import { formatEmployeeList } from "../formatters/employee-formatter.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const searchEmployeesSchema = {
  q: z
    .string()
    .optional()
    .describe("Free-text search across name, email, and phone."),
  role: z
    .number()
    .int()
    .optional()
    .describe("Numeric role id to filter by. Omit for any role."),
  department: z
    .number()
    .int()
    .optional()
    .describe("Department id (from list_departments). Omit for any department."),
  company: z
    .string()
    .optional()
    .describe("Company filter: either a numeric company id as a string, or (part of) the company name."),
  archived: z
    .boolean()
    .optional()
    .describe("true to list archived (deleted) employees instead of active ones."),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)."),
  perpage: z.number().int().min(1).max(200).default(50).describe("Page size (max 200)."),
};

export function registerSearchEmployees(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "search_employees",
    [
      "Search the company's employees. Each row shows name, email, role, company, department, and the travel policy that actually applies to the person — including how it applies (assigned personally, inherited from their department, or from their role). Pair with get_employee for a single person's card.",
      "",
      "USER-FACING LANGUAGE: speak about 'employees', 'their travel policy', 'department'. Never quote internal labels, REST routes, or raw field names.",
      "",
      "When to call:",
      "  • 'Find employee <name/email>' → q.",
      "  • 'Who is in department X?' → department id from list_departments.",
      "  • 'Which policy applies to these people?' → read the policy column of the results.",
      "",
      "Available to directors and travel managers (also account admins/editors); scope is the caller's own companies.",
    ].join("\n"),
    { ...searchEmployeesSchema, ...impersonationInputSchema },
    READ_ONLY_TOOL,
    withImpersonation(
      async ({
        q,
        role,
        department,
        company,
        archived,
        page,
        perpage,
      }: {
        q?: string;
        role?: number;
        department?: number;
        company?: string;
        archived?: boolean;
        page: number;
        perpage: number;
      }) => {
        try {
          const data = await client.get<EmployeesSearchResponse>("/users", {
            q,
            role,
            department,
            company,
            archived: archived ? 1 : undefined,
            page,
            perpage,
          });
          return {
            content: [{ type: "text" as const, text: formatEmployeeList(data) }],
          };
        } catch (error) {
          return {
            content: [{ type: "text" as const, text: `Error searching employees: ${(error as Error).message}` }],
            isError: true,
          };
        }
      },
    ),
  );
}
