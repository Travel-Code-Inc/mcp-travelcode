import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { AlertsByCountryResponse } from "../client/types.js";
import { formatAlertsByCountry } from "../formatters/risk-alerts-formatter.js";

export function getRiskAlertsByCountryHandler(client: TravelCodeApiClient) {
  return async () => {
    try {
      const data = await client.get<AlertsByCountryResponse>("/risk-alerts/by-country");
      return {
        content: [{ type: "text" as const, text: formatAlertsByCountry(data) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching alerts by country: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  };
}

export function registerGetRiskAlertsByCountry(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_risk_alerts_by_country",
    [
      "Active risk alerts grouped by ISO-3 country code — one ISO maps to the list of its current alerts. Use for a high-level country-heatmap view. Single round-trip; backend groups in-memory off the same cached payload as get_active_risk_alerts.",
      "",
      "USER-FACING LANGUAGE: 'countries with active warnings', 'risk heatmap'. Never quote ISO codes raw — translate to country names where possible.",
      "",
      "When to call:",
      "  • 'Which countries currently have safety warnings?'",
      "  • Before deciding whom in the travelers list might be in a hot zone.",
    ].join("\n"),
    {},
    getRiskAlertsByCountryHandler(client),
  );
}
