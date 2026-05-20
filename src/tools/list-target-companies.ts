import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { TargetCompany } from "../util/impersonation.js";
import { withImpersonation } from "../util/impersonation-tool.js";

export const listTargetCompaniesSchema = {
  actAs: z
    .string()
    .email()
    .describe("Target user email (admin acts on behalf of this user)."),
};

interface CompaniesResponse {
  items?: TargetCompany[];
  currentCompanyId?: number | null;
}

export function registerListTargetCompanies(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "list_target_companies",
    "List the legal-entity companies attached to a user, for admin impersonation. Call this when another tool tells you the target user has multiple companies and you need to pick one before retrying.",
    listTargetCompaniesSchema,
    withImpersonation(async () => {
      try {
        const data = await client.get<CompaniesResponse>("/companies");
        const items = Array.isArray(data?.items) ? data!.items : [];
        if (items.length === 0) {
          return {
            content: [{ type: "text", text: "Target user has no companies." }],
          };
        }
        const lines = items.map((c) => {
          const name = c.legalName || c.name || `Company ${c.id}`;
          const tail = c.taxIdentificationNumber ? ` — ${c.taxIdentificationNumber}` : "";
          return `- ${name}${tail} (id=${c.id})`;
        });
        return {
          content: [{
            type: "text",
            text: `Companies for the target user:\n\n${lines.join("\n")}\n\nAsk the user to pick one, then call the original tool again with actAsCompanyId set to the chosen ID.`,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error listing companies: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }),
  );
}
