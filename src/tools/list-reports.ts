import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const listReportsSchema = {
  lang: z.enum(["en", "ru"]).optional().describe("Language for report titles and descriptions (default: account language)"),
};

interface ReportSummary {
  id: string;
  group?: string;
  title?: string;
  description?: string;
}

export function registerListReports(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "list_reports",
    "List analytics reports (Dynamic Reports) available to the current user. Returns report ids to use with get_report and get_report_element. New reports appear here automatically as they are added on the backend.",
    listReportsSchema,
    READ_ONLY_TOOL,
    async ({ lang }) => {
      try {
        const data = await client.get<ReportSummary[]>("/reports", { lang });
        const reports = Array.isArray(data) ? data : [];
        if (reports.length === 0) {
          return { content: [{ type: "text", text: "No reports are available for this user." }] };
        }
        const lines = reports.map((r) => {
          const title = r.title ? ` — ${r.title}` : "";
          const group = r.group ? ` [${r.group}]` : "";
          const desc = r.description ? `\n  ${r.description}` : "";
          return `- ${r.id}${group}${title}${desc}`;
        });
        return {
          content: [{
            type: "text",
            text: `Available reports (${reports.length}):\n\n${lines.join("\n")}\n\nCall get_report with a report id to see its filters and elements.`,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error listing reports: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
