import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { ConflictsEnvelope } from "../client/types.js";
import { formatConflicts } from "../formatters/risk-alerts-formatter.js";

export const getConflictsSchema = {
  days: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .describe("Lookback window in days (1..30). Defaults to the upstream default when omitted."),
  country: z
    .string()
    .length(3)
    .optional()
    .describe("Filter to ISO-3 country code, e.g. 'UKR'. Case-insensitive."),
  min_severity: z
    .enum(["Low", "Medium", "High", "Critical"])
    .optional()
    .describe("Minimum severity to include. 'Critical' returns only the most severe events."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe("Page size (1..200). Ignored if pagination is auto when no country/skip is set."),
  skip: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Pagination offset. Setting either skip or country disables auto-pagination."),
};

interface ConflictsArgs {
  days?: number;
  country?: string;
  min_severity?: "Low" | "Medium" | "High" | "Critical";
  limit?: number;
  skip?: number;
}

export function getConflictsHandler(client: TravelCodeApiClient) {
  return async ({ days, country, min_severity, limit, skip }: ConflictsArgs) => {
    try {
      const data = await client.get<ConflictsEnvelope>("/risk-alerts/conflicts", {
        days,
        country: country ? country.toUpperCase() : undefined,
        min_severity,
        limit,
        skip,
      });
      return {
        content: [{ type: "text" as const, text: formatConflicts(data) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching conflicts: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  };
}

export function registerGetConflicts(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_conflicts",
    [
      "Recent armed-conflict events worldwide (proxied from GDELT). Returns event date, location, severity, description, source URL, and a per-event mention-count signal of media attention.",
      "",
      "USER-FACING LANGUAGE: 'recent conflicts', 'security incidents', 'unrest events'. Cite country names, not ISO codes; do not quote raw GDELT event codes.",
      "",
      "When to call:",
      "  • 'Any recent unrest in <country>?' → set country (ISO-3) + days.",
      "  • 'What's happening in Ukraine this week?' → country='UKR', days=7.",
      "  • Broad pulse-check → no params, server paginates the full feed.",
      "",
      "Severity ladder: Critical > High > Medium. Use min_severity to cut through noise.",
    ].join("\n"),
    getConflictsSchema,
    getConflictsHandler(client),
  );
}
