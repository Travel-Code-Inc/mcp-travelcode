import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { HotelLocationDetailResponse } from "../client/types.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const getHotelLocationSchema = {
  id: z.number().int().describe("Location ID (from search_hotel_locations)"),
};

export function registerGetHotelLocation(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_hotel_location",
    "Get hotel location details by ID. Returns name and entity type (city, region, hotel).",
    getHotelLocationSchema,
    READ_ONLY_TOOL,
    async ({ id }) => {
      try {
        const data = await client.getWithTokenParam<HotelLocationDetailResponse>(
          "/data/hotel-location",
          { id }
        );

        const loc = data.result;
        const text = [
          `Location #${loc.id}`,
          `Name: ${loc.nameEn}${loc.nameRu !== loc.nameEn ? ` (${loc.nameRu})` : ""}`,
          `Type: ${loc.entityType}`,
        ].join("\n");

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting hotel location: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
