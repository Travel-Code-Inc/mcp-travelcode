import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { AdvisoriesEnvelope } from "../client/types.js";
import { formatAdvisories } from "../formatters/risk-alerts-formatter.js";

export const getAdvisoriesSchema = {
  country: z
    .string()
    .length(3)
    .optional()
    .describe("Filter to a single country, ISO-3 code (e.g. 'UKR'). Case-insensitive."),
  min_level: z
    .number()
    .int()
    .min(1)
    .max(4)
    .optional()
    .describe("Minimum advisory level (1..4). 4 = highest concern ('Do not travel'); 1 = lowest ('Exercise normal precautions')."),
};

interface AdvisoriesArgs {
  country?: string;
  min_level?: number;
}

export function getAdvisoriesHandler(client: TravelCodeApiClient) {
  return async ({ country, min_level }: AdvisoriesArgs) => {
    try {
      const data = await client.get<AdvisoriesEnvelope>("/risk-alerts/advisories", {
        country: country ? country.toUpperCase() : undefined,
        min_level,
      });
      return {
        content: [{ type: "text" as const, text: formatAdvisories(data) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching advisories: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  };
}

export function registerGetAdvisories(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_advisories",
    [
      "Government travel advisories from US State Department, UK FCDO, and Canada GAC — level 1 (lowest) through 4 (highest, 'do not travel'). Returns per-country summary plus reasons and source-agency breakdown.",
      "",
      "USER-FACING LANGUAGE: 'travel advisories', 'government safety guidance'. Translate level numbers to plain English (e.g. level 3 → 'Reconsider travel').",
      "",
      "When to call:",
      "  • 'Where shouldn't people travel right now?' → min_level=3 or 4.",
      "  • 'What does the US say about <country>?' → country=ISO-3, mention agency US in answer.",
      "  • Broad sweep → no params, response is sorted high → low.",
    ].join("\n"),
    getAdvisoriesSchema,
    getAdvisoriesHandler(client),
  );
}
