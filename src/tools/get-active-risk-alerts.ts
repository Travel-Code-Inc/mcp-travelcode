import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { ActiveRiskAlertsResponse } from "../client/types.js";
import { formatActiveAlerts } from "../formatters/risk-alerts-formatter.js";

export function getActiveRiskAlertsHandler(client: TravelCodeApiClient) {
  return async () => {
    try {
      const data = await client.get<ActiveRiskAlertsResponse>("/risk-alerts/active");
      return {
        content: [{ type: "text" as const, text: formatActiveAlerts(data) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching active risk alerts: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  };
}

export function registerGetActiveRiskAlerts(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_active_risk_alerts",
    [
      "List ALL currently active travel risk alerts worldwide — natural disasters, weather warnings, conflicts, health emergencies. Sourced from GDACS, USGS, EONET, NWS, ReliefWeb. Cached server-side (5 min TTL).",
      "",
      "USER-FACING LANGUAGE: speak about 'risk alerts', 'safety warnings', 'active incidents'. Never quote internal IDs, source codes, or REST paths.",
      "",
      "When to call:",
      "  • 'What's happening worldwide right now?' / 'Show all active alerts'.",
      "  • Before more specific filters — get the big picture, then drill into a country.",
      "",
      "For a country-focused view prefer get_country_advisory + get_risk_alerts_by_country.",
    ].join("\n"),
    {},
    getActiveRiskAlertsHandler(client),
  );
}
