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
      "Show all rooms and rates for one hotel: room types, prices, meal plans, and cancellation rules. Chain this after search_hotels silently — do not narrate it as a separate step to the user.",
      "",
      "USER-FACING LANGUAGE (mandatory):",
      "  • Speak about 'rooms', 'rates', 'free cancellation until <date>', 'penalty after <date>', 'refundable / non-refundable / partially refundable'. Never quote internal labels: hotel id, search reference, offer reference, parameter names, REST routes, error codes.",
      "  • The 'Hotel page: <url>' line IS for the user — surface it as a clickable link to view the hotel on the agency site. Do not show the raw URL string in chat; render it as a friendly link.",
      "  • The block marked '(internal — do not show to user)' is for downstream tool calls only. Never quote or mention it.",
      "",
      "Pass the SAME nationality and guest composition (including children's ages) that were used in search_hotels — otherwise prices and availability will diverge.",
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
