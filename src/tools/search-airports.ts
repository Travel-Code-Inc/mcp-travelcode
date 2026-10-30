import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { Airport } from "../client/types.js";
import { formatAirportList } from "../formatters/airport-formatter.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const searchAirportsSchema = {
  query: z.string().describe("Search term: airport name, city name, or IATA code (e.g. 'London', 'JFK', 'Heathrow')"),
  limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of results to return"),
};

export function registerSearchAirports(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "search_airports",
    "Search for airports by name, city, or IATA code. Returns a list of matching airports and cities with their codes. Use this to find airport codes before searching for flights.",
    searchAirportsSchema,
    READ_ONLY_TOOL,
    async ({ query, limit }) => {
      try {
        const airports = await client.get<Airport[]>("/data/airports", {
          search: query,
          limit,
          offset: 0,
          sort: "title",
          sortOrder: "ASC",
          scope: "country,city",
        });

        return {
          content: [{ type: "text", text: formatAirportList(airports, query) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error searching airports: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
