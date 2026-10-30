import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { Airport } from "../client/types.js";
import { formatAirportDetail } from "../formatters/airport-formatter.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const getAirportSchema = {
  code: z.string().describe("Airport IATA code (e.g. 'JFK', 'LHR') or internal airport ID"),
};

export function registerGetAirport(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_airport",
    "Get detailed information about a specific airport or city by its IATA code. Returns name, city, and country.",
    getAirportSchema,
    READ_ONLY_TOOL,
    async ({ code }) => {
      try {
        const airport = await client.get<Airport>(`/data/airports/${encodeURIComponent(code)}`, {
          type: "iata",
          scope: "country,city",
        });

        return {
          content: [{ type: "text", text: formatAirportDetail(airport) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting airport "${code}": ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
