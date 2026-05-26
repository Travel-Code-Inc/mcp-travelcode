import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { CountryRiskScoreEnvelope } from "../client/types.js";
import { formatCountryRiskScore } from "../formatters/risk-alerts-formatter.js";

export const getCountryRiskScoreSchema = {
  iso: z
    .string()
    .length(3)
    .describe("ISO 3166-1 alpha-3 country code, e.g. 'USA', 'UKR'. Case-insensitive."),
};

export function getCountryRiskScoreHandler(client: TravelCodeApiClient) {
  return async ({ iso }: { iso: string }) => {
    const upperIso = iso.toUpperCase();
    try {
      const data = await client.get<CountryRiskScoreEnvelope>(
        `/risk-alerts/risk-score/${encodeURIComponent(upperIso)}`,
      );
      return {
        content: [{ type: "text" as const, text: formatCountryRiskScore(data) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching risk score for ${upperIso}: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  };
}

export function registerGetCountryRiskScore(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_country_risk_score",
    [
      "Composite numeric risk score for a country — combines baseline score, active alert impact, and advisory level into a single number plus a breakdown of the calculation.",
      "",
      "Some countries (e.g. USA per upstream design) have no risk-score record — response will say 'No risk-score data available for this country.' Treat that as informational, not an error.",
      "",
      "USER-FACING LANGUAGE: 'risk score', 'safety rating'. Mention country by name, not ISO.",
    ].join("\n"),
    getCountryRiskScoreSchema,
    getCountryRiskScoreHandler(client),
  );
}
