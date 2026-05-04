import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { HotelOffer, HotelSSECompleted, HotelSSEHotelsBatch, HotelSSESortedBatch } from "../client/types.js";
import { formatHotelResults } from "../formatters/hotel-formatter.js";

const guestSchema = z.object({
  adults: z.number().int().min(1).max(4).describe("Number of adults (1-4)"),
  children: z.number().int().min(0).max(3).optional().describe("Number of children (0-3)"),
  childrenAges: z
    .array(z.number().int().min(0).max(17))
    .optional()
    .describe("Array of child ages (0-17), required if children > 0"),
});

const propertyTypeEnum = z.enum([
  "hotel",
  "aparthotel",
  "apartment",
  "hostel",
  "guesthouse",
  "bed_and_breakfast",
  "resort",
  "villa",
  "motel",
  "bungalow",
  "inn",
  "country_house",
  "holiday_park",
  "camping",
  "boutique",
  "capsule",
  "specialty",
]);

const filterSchema = z.object({
  minPrice: z.number().int().optional().describe("Minimum price per night"),
  maxPrice: z.number().int().optional().describe("Maximum price per night"),
  starRating: z.array(z.number().int().min(1).max(5)).optional().describe("Hotel star ratings, e.g. [4, 5]"),
  boards: z
    .array(z.enum(["RO", "BI", "LI", "DI", "HB", "FB", "AI"]))
    .optional()
    .describe("Meal plan codes: RO=Room Only, BI=Breakfast, HB=Half Board, FB=Full Board, AI=All Inclusive"),
  payments: z
    .array(z.enum(["full_refund"]))
    .optional()
    .describe("Payment filters: full_refund = only fully refundable"),
  propertyTypes: z
    .array(propertyTypeEnum)
    .optional()
    .describe(
      "Limit to specific accommodation types. Map the user's wording to the closest code; " +
      "when intent is ambiguous, include multiple codes. " +
      "hotel=classic hotel; aparthotel=serviced apartments with hotel-style reception; " +
      "apartment=standalone apartment or studio rental; hostel=hostel or dorm; " +
      "guesthouse=guesthouse or pension; bed_and_breakfast=small lodging with breakfast; " +
      "resort=resort or spa complex, often all-inclusive; villa=villa or private luxury house; " +
      "motel=roadside motel; bungalow=small standalone cabin; inn=small traditional lodging; " +
      "country_house=rural or country house, cottage, dacha; holiday_park=holiday park or resort village; " +
      "camping=campground or glamping; boutique=boutique hotel; capsule=capsule hotel; " +
      "specialty=unusual lodging such as treehouse, ice hotel, boat, etc. " +
      "Examples: 'apartment' → [\"apartment\",\"aparthotel\"]; 'cottage' → [\"country_house\",\"villa\"]; " +
      "'B&B' → [\"bed_and_breakfast\"]; 'hostel' → [\"hostel\"]; 'all-inclusive' → [\"resort\"]."
    ),
}).optional();

export const searchHotelsSchema = {
  location: z
    .number()
    .int()
    .describe("Location ID from search_hotel_locations. Positive = city/region, negative = single hotel"),
  checkin: z.string().describe("Check-in date (YYYY-MM-DD)"),
  checkout: z.string().describe("Check-out date (YYYY-MM-DD)"),
  country_code: z.string().describe("Guest nationality ISO code (e.g. BY, RU, US)"),
  guests: z.array(guestSchema).min(1).describe("Array of rooms, each with adults count and optional children"),
  sort: z
    .enum(["recommend", "price"])
    .default("recommend")
    .describe("Sort mode: recommend (default) or price"),
  offset: z.number().int().min(0).default(0).describe("Pagination offset"),
  limit: z.number().int().min(1).max(50).default(20).describe("Hotels per page"),
  filter: filterSchema,
};

export function registerSearchHotels(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "search_hotels",
    [
      "Search hotels by location, dates, and guests. Chain location lookup → this tool silently without narrating intermediate steps to the user. Returns hotel offers with prices, star ratings, meal plans, and refundability. Supports filtering by property type, stars, price, meal plan, and full-refund only.",
      "",
      "USER-FACING LANGUAGE (mandatory):",
      "  • Talk in plain language. Never expose internal labels or values: search reference, location id, parameter names (country_code, guests, sort, filter, …), REST routes, or error codes. Just describe results.",
      "  • The block at the bottom of this tool's output marked '(internal — do not show to user)' is for downstream tool calls only. Never quote it or mention it.",
      "",
      "Guest-data rules:",
      "  • Nationality of the lead guest is REQUIRED for hotels — pricing depends on it. The same nationality must be reused at booking.",
      "  • If the user did not give a nationality and the booking is for 1 adult, call get_main_client first and propose that traveler. If they accept, reuse that traveler at booking.",
      "  • For 2+ adults or a family, ask only the lead guest's nationality at search; collect first/last name + DOB + gender for every guest later, before booking. Passport is NOT required for hotels — do not ask for it unless the user volunteers it.",
      "  • If there are children, ask each child's age up front and pass them as childrenAges. Re-use those exact ages when calling create_order.",
      "",
      "Role-driven behavior (from get_current_user, called once at session start):",
      "  • Traveller (employee_traveller): force 1 adult, no children. Call get_main_client silently and use that traveler's nationality. Refuse multi-guest searches.",
      "  • Developer: prefix the user-facing reply with '[Developer mode]'.",
    ].join("\n"),
    searchHotelsSchema,
    async ({ location, checkin, checkout, country_code, guests, sort, offset, limit, filter }) => {
      try {
        const body: Record<string, unknown> = {
          location,
          checkin,
          checkout,
          countryCode: country_code,
          guests,
          sort,
          offset,
          limit,
        };
        if (filter) {
          body.filter = filter;
        }

        const events = await client.postSSE("/search/hotels/stream", body);

        // Collect hotels from SSE events
        const hotels: HotelOffer[] = [];
        let totalCount = 0;
        let cacheKey: string | undefined;

        for (const { event, data } of events) {
          if (event === "hotels") {
            const batch = data as HotelSSEHotelsBatch;
            hotels.push(...batch.hotels);
          } else if (event === "sorted_hotels") {
            const batch = data as HotelSSESortedBatch;
            hotels.push(...batch.hotels);
            totalCount = batch.total;
          } else if (event === "completed") {
            const completed = data as HotelSSECompleted;
            totalCount = completed.count;
            cacheKey = completed.cacheKey;
            // In price mode, completed contains the hotels
            if (completed.hotels && completed.hotels.length > 0) {
              hotels.length = 0; // clear intermediate results
              hotels.push(...completed.hotels);
            }
          } else if (event === "error") {
            const err = data as { message: string };
            return {
              content: [{ type: "text", text: `Hotel search error: ${err.message}` }],
              isError: true,
            };
          } else if (event === "timeout") {
            return {
              content: [{ type: "text", text: `Hotel search timed out. Try narrowing your search (fewer dates, specific filters).` }],
              isError: true,
            };
          }
        }

        return {
          content: [{ type: "text", text: formatHotelResults(hotels, totalCount, cacheKey) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error searching hotels: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
