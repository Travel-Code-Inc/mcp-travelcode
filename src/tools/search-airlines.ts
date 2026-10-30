import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { Airline } from "../client/types.js";
import { formatAirlineList } from "../formatters/airline-formatter.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const searchAirlinesSchema = {
  query: z.string().describe("Search term: airline name or IATA code (e.g. 'British Airways', 'BA', 'Lufthansa')"),
  limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of results to return"),
};

export function registerSearchAirlines(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "search_airlines",
    "Search for airlines by name or IATA code. Returns matching airlines with their codes and names. Use this to find airline codes for filtering flight searches.",
    searchAirlinesSchema,
    READ_ONLY_TOOL,
    async ({ query, limit }) => {
      try {
        const airlines = await client.get<Airline[]>("/data/airlines", {
          search: query,
          limit,
          offset: 0,
          sort: "title",
          sortOrder: "ASC",
        });

        return {
          content: [{ type: "text", text: formatAirlineList(airlines, query) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error searching airlines: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
