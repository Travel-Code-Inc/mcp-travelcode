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
      "Search hotels by location, dates, and guests. Requires a location ID from search_hotel_locations — chain the calls silently without explaining intermediate steps to the user. Returns hotel offers with prices, star ratings, and meal plans. Supports filtering by property type (hotel, apartment, villa, hostel, B&B, resort, etc.), stars, price, meal plan, and refundability.",
      "",
      "Role-based behavior (from get_current_user — call it once at the start of the session and reuse):",
      "  • role = 'employee_traveller': force `guests = [{adults: 1}]`. Refuse multi-guest searches. Call get_first_client FIRST (silently, without asking) and use that traveler's nationality as `country_code`.",
      "  • role = 'developer': prefix the user-facing reply with '[Developer mode]' so the user always sees the search ran in dev mode.",
      "  • Other roles: standard rules below.",
      "",
      "Standard guest data rules:",
      "  • `country_code` is the lead-guest nationality and is REQUIRED. Pricing and availability depend on it. The same value MUST be used as the lead guest's nationality at create_order.",
      "  • If the user did not supply nationality and the booking is for 1 adult, call get_first_client first and propose that traveler's nationality. If they accept, reuse that client at create_order.",
      "  • For multi-adult or family bookings, ask the user only for the lead guest's nationality at this stage. Full passport details are collected later, before create_order.",
      "  • If the booking includes children, you MUST ask each child's age up-front and pass them in `guests[].childrenAges`. The same ages will be required at create_order — pass them through as `expected_children_ages`.",
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
          content: [{ type: "text", text: formatHotelResults(hotels, totalCount) }],
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
