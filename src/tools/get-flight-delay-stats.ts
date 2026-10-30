import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { FlightDelayStats } from "../client/types.js";
import { formatFlightDelayStats } from "../formatters/flight-stats-formatter.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const getFlightDelayStatsSchema = {
  flight_number: z
    .string()
    .describe("Flight number including airline code (e.g. 'LO776', 'BA304')"),
};

export function registerGetFlightDelayStats(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_flight_delay_stats",
    "Get historical delay statistics for a specific flight number. Shows how often the flight is delayed, average delay duration, and reliability assessment. Use this to evaluate a flight's punctuality before booking.",
    getFlightDelayStatsSchema,
    READ_ONLY_TOOL,
    async ({ flight_number }) => {
      try {
        const normalized = flight_number.replace(/\s+/g, "").toUpperCase();
        const stats = await client.getFlightStats<FlightDelayStats>(
          `/flights/${encodeURIComponent(normalized)}/delays`
        );

        return {
          content: [{ type: "text", text: formatFlightDelayStats(stats, normalized) }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error getting delay stats for "${flight_number}": ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    }
  );
}
