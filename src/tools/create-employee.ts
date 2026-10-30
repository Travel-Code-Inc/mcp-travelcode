import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient, TravelCodeValidationError } from "../client/api-client.js";
import { EmployeeDetail } from "../client/types.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";
import { formatEmployeeDetail } from "../formatters/employee-formatter.js";
import { ADDITIVE_WRITE_TOOL } from "../util/tool-annotations.js";

export const createEmployeeSchema = {
  firstName: z.string().min(1).describe("Employee first name."),
  lastName: z.string().min(1).describe("Employee last name."),
  email: z.string().email().describe("Work email — must not already exist in the system."),
  phone: z.string().optional().describe("Phone number."),
  role: z.number().int().describe("Numeric role id for the new employee."),
  department: z
    .string()
    .optional()
    .describe("Department NAME (as shown in list_departments), not an id. Omit to leave the person without a department."),
  companyId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Legal-entity company id. REQUIRED when the account has several companies — use list_target_companies to pick one."),
  travelPolicyId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Travel policy id to assign personally right away. Omit to let department/role policies apply."),
  expenseAccess: z.boolean().optional().describe("Grant access to the expenses module."),
};

export function registerCreateEmployee(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "create_employee",
    [
      "Create a new employee in the company: name, email, phone, role, and optionally a department, a personal travel policy, and expense access. Returns the created employee's card.",
      "",
      "USER-FACING LANGUAGE: speak about 'adding an employee', 'their department and travel policy'. Never quote internal labels, REST routes, or raw field names.",
      "",
      "Available to directors and travel managers (also account admins/editors).",
      "",
      "Common rejections, explained in the result:",
      "  • the account has several companies and no company was chosen — pick one via list_target_companies and retry with companyId;",
      "  • the email is already registered — ask the user for a different address.",
    ].join("\n"),
    { ...createEmployeeSchema, ...impersonationInputSchema },
    ADDITIVE_WRITE_TOOL,
    withImpersonation(
      async ({
        firstName,
        lastName,
        email,
        phone,
        role,
        department,
        companyId,
        travelPolicyId,
        expenseAccess,
      }: {
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
        role: number;
        department?: string;
        companyId?: number;
        travelPolicyId?: number;
        expenseAccess?: boolean;
      }) => {
        const body: Record<string, unknown> = { firstName, lastName, email, role };
        if (phone !== undefined) body.phone = phone;
        if (department !== undefined) body.department = department;
        if (companyId !== undefined) body.companyId = companyId;
        if (travelPolicyId !== undefined) body.travelPolicyId = travelPolicyId;
        if (expenseAccess !== undefined) body.expenseAccess = expenseAccess;

        try {
          const data = await client.post<EmployeeDetail>("/users", body);
          return {
            content: [{ type: "text" as const, text: `Employee created.\n\n${formatEmployeeDetail(data)}` }],
          };
        } catch (error) {
          let message = `Error creating employee: ${(error as Error).message}`;
          if (error instanceof TravelCodeValidationError) {
            const raw = error.message.toLowerCase();
            if (raw.includes("company")) {
              message =
                "The employee was not created: this account has several companies, so you must say which company the new employee belongs to. Call list_target_companies, ask the user to pick one, then retry with companyId set.";
            } else if (raw.includes("email") || raw.includes("already")) {
              message = `The employee was not created: ${error.message}. Most likely this email is already registered — ask the user for a different address.`;
            } else {
              message = `The employee was not created: ${error.message}`;
            }
          }
          return {
            content: [{ type: "text" as const, text: message }],
            isError: true,
          };
        }
      },
    ),
  );
}
