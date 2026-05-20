import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { FlightSearchResultsResponse } from "../client/types.js";
import { formatFilteredResults } from "../formatters/flight-formatter.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";

export const getFlightResultsSchema = {
  cache_id: z.string().describe("Cache ID from a previous search_flights result"),
  max_stops: z.number().int().min(0).max(3).optional().describe("Maximum number of stops (0 = direct only, 1 = max 1 stop, etc.)"),
  sort_by: z.enum(["price", "duration"]).default("price").describe("Sort results by price or duration"),
  sort_order: z.enum(["asc", "desc"]).default("asc").describe("Sort direction"),
  airlines: z.array(z.string()).optional().describe("Filter to specific airline IATA codes (e.g. ['BA', 'LH'])"),
  max_price: z.number().optional().describe("Maximum price per person"),
  baggage_only: z.boolean().default(false).describe("Only show flights with included baggage"),
  offset: z.number().int().min(0).default(0).describe("Pagination offset"),
  limit: z.number().int().min(1).max(50).default(10).describe("Number of results to return"),
};

export function registerGetFlightResults(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_flight_results",
    "Retrieve or filter existing flight search results using a cache ID from a previous search. Apply filters (direct flights, specific airlines, price range), change sorting, or paginate through results without running a new search. Cache expires after ~15 minutes. If the originating search_flights call used actAs/actAsCompanyId, pass the SAME values here so the cache is read as the same target user.",
    { ...getFlightResultsSchema, ...impersonationInputSchema },
    withImpersonation(async ({ cache_id, max_stops, sort_by, sort_order, airlines, max_price, baggage_only, offset, limit }) => {
      try {
        // Build query params
        const params: Record<string, string | number | boolean | undefined> = {
          offset,
          limit,
          sort: sort_by,
          sortOrder: sort_order.toUpperCase(),
          embedded: "airlines,dictionaries",
        };

        // Build filter params
        if (max_stops !== undefined) {
          params["filter[transfer]"] = max_stops;
          params["filter[transferReturn]"] = max_stops;
        }

        if (max_price !== undefined) {
          params["filter[maxprice]"] = max_price;
        }

        if (baggage_only) {
          params["filter[baggage]"] = 1;
        }

        if (airlines && airlines.length > 0) {
          params["filter[airlines]"] = airlines.map((a) => a.toUpperCase()).join(",");
        }

        const results = await client.get<FlightSearchResultsResponse>(
          `/search/flights/${encodeURIComponent(cache_id)}`,
          params
        );

        // Build filter summary
        const filterParts: string[] = [];
        if (max_stops !== undefined) {
          filterParts.push(max_stops === 0 ? "Direct only" : `Max ${max_stops} stop(s)`);
        }
        if (airlines && airlines.length > 0) {
          filterParts.push(`Airlines: ${airlines.join(", ")}`);
        }
        if (max_price !== undefined) {
          filterParts.push(`Max price: ${max_price}`);
        }
        if (baggage_only) {
          filterParts.push("Baggage included only");
        }
        filterParts.push(`Sorted by ${sort_by} (${sort_order})`);

        const text = formatFilteredResults(results, cache_id, filterParts.join(" | "));

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting flight results: ${(error as Error).message}` }],
          isError: true,
        };
      }
    })
  );
}
