import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { CountryAdvisoryEnvelope } from "../client/types.js";
import { formatCountryAdvisory } from "../formatters/risk-alerts-formatter.js";

export const getCountryAdvisorySchema = {
  iso: z
    .string()
    .length(3)
    .describe("ISO 3166-1 alpha-3 country code, e.g. 'USA', 'GBR', 'UKR'. Case-insensitive — backend upper-cases."),
};

export function getCountryAdvisoryHandler(client: TravelCodeApiClient) {
  return async ({ iso }: { iso: string }) => {
    const upperIso = iso.toUpperCase();
    try {
      const data = await client.get<CountryAdvisoryEnvelope>(
        `/risk-alerts/country/${encodeURIComponent(upperIso)}`,
      );
      return {
        content: [{ type: "text" as const, text: formatCountryAdvisory(data) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching advisory for ${upperIso}: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  };
}

export function registerGetCountryAdvisory(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_country_advisory",
    [
      "Get a single country's travel advisory snapshot — overall advisory level, description, risk score, last update.",
      "",
      "If the upstream has no record, response will say so politely ('No advisory data available for this country.') — do NOT treat as an error.",
      "",
      "USER-FACING LANGUAGE: talk about 'travel advisory', 'safety status', 'risk level'. Mention the country by name, not ISO code.",
    ].join("\n"),
    getCountryAdvisorySchema,
    getCountryAdvisoryHandler(client),
  );
}
