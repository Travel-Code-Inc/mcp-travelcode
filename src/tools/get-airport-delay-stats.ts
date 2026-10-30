import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { AirportDelayStats } from "../client/types.js";
import { formatAirportDelayStats } from "../formatters/flight-stats-formatter.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const getAirportDelayStatsSchema = {
  airport_code: z
    .string()
    .describe("IATA airport code (e.g. 'JFK', 'LHR', 'WAW')"),
  date: z
    .string()
    .describe("Date in YYYY-MM-DD format (e.g. '2026-02-15')"),
};

export function registerGetAirportDelayStats(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_airport_delay_stats",
    "Get current delay statistics for an airport on a specific date. Shows average departure/arrival delays and cancellation rates. Use this during weather events or disruptions to assess the situation at an airport.",
    getAirportDelayStatsSchema,
    READ_ONLY_TOOL,
    async ({ airport_code, date }) => {
      try {
        const code = airport_code.toUpperCase();
        const stats = await client.getFlightStats<AirportDelayStats>(
          `/airports/iata/${encodeURIComponent(code)}/delays/${date}`
        );

        return {
          content: [{ type: "text", text: formatAirportDelayStats(stats, code, date) }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error getting delay stats for airport ${airport_code}: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    }
  );
}
