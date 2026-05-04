import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { HotelOffersResponse } from "../client/types.js";
import { formatHotelOffers } from "../formatters/hotel-formatter.js";

const guestSchema = z.object({
  adults: z.number().int().min(1).max(4).describe("Number of adults (1-4)"),
  children: z.number().int().min(0).max(3).optional().describe("Number of children (0-3)"),
  childrenAges: z
    .array(z.number().int().min(0).max(17))
    .optional()
    .describe("Array of child ages (0-17), required if children > 0"),
});

export const getHotelOffersSchema = {
  id: z.number().int().describe("Hotel ID (from search_hotels results)"),
  checkin: z.string().describe("Check-in date (YYYY-MM-DD)"),
  checkout: z.string().describe("Check-out date (YYYY-MM-DD)"),
  country_code: z.string().describe("Guest nationality ISO code (e.g. BY, RU, US)"),
  guests: z.array(guestSchema).min(1).describe("Array of rooms, each with adults count and optional children"),
  location: z
    .number()
    .int()
    .optional()
    .describe("Location ID from prior search — enables cache reuse for faster results"),
};

export function registerGetHotelOffers(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_hotel_offers",
    [
      "Get all available rooms and rates for a specific hotel from all suppliers. Returns room types, prices, meal plans, and cancellation policies. The hotel ID comes from search_hotels results — do not explain this to the user, just chain the calls silently.",
      "",
      "Pass the SAME `country_code` and `guests` (including childrenAges) that were used in search_hotels. Mismatching here will return different prices than the user saw on the list.",
    ].join("\n"),
    getHotelOffersSchema,
    async ({ id, checkin, checkout, country_code, guests, location }) => {
      try {
        const body: Record<string, unknown> = {
          id,
          checkin,
          checkout,
          countryCode: country_code,
          guests,
        };
        if (location !== undefined) {
          body.location = location;
        }

        const data = await client.postWithTokenParam<HotelOffersResponse>(
          "/search/hotels/offers",
          body
        );

        return {
          content: [{ type: "text", text: formatHotelOffers(data) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting hotel offers: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
