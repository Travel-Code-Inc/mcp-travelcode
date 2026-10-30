import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { HotelLocationSearchResponse } from "../client/types.js";
import { formatHotelLocations } from "../formatters/hotel-formatter.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const searchHotelLocationsSchema = {
  query: z.string().describe("Search query — city, region, or hotel name (supports Cyrillic and Latin)"),
  limit: z.number().int().min(1).max(50).default(15).describe("Max results to return"),
};

export function registerSearchHotelLocations(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "search_hotel_locations",
    "Search for hotel locations (cities, regions, hotels) by name. Returns location IDs needed for hotel search.",
    searchHotelLocationsSchema,
    READ_ONLY_TOOL,
    async ({ query, limit }) => {
      try {
        const data = await client.getWithTokenParam<HotelLocationSearchResponse>(
          "/data/hotel-locations",
          { search: query, limit }
        );

        return {
          content: [{ type: "text", text: formatHotelLocations(data) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error searching hotel locations: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
