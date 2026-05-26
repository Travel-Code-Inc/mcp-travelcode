import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { TravelersListResponse } from "../client/types.js";
import { formatTravelerList } from "../formatters/traveler-formatter.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";

export const searchTravelersSchema = {
  active: z
    .boolean()
    .optional()
    .describe("Only travelers in the active window (±1 day from today). Use this for duty-of-care 'who is traveling right now' queries."),
  trip_from: z
    .string()
    .optional()
    .describe("Filter trips ending on or after this date (YYYY-MM-DD)."),
  trip_to: z
    .string()
    .optional()
    .describe("Filter trips starting on or before this date (YYYY-MM-DD)."),
  country_iso: z
    .string()
    .length(3)
    .optional()
    .describe("Destination country, ISO 3166-1 alpha-3 (e.g. 'USA', 'GBR')."),
  q: z
    .string()
    .min(2)
    .optional()
    .describe("Free-text search across first name, last name (both Cyrillic and Latin), and email. Minimum 2 characters."),
  order_status: z
    .string()
    .optional()
    .describe("Comma-separated order statuses to include (e.g. 'finish,pre_book'). Defaults to non-deleted statuses when absent."),
  offset: z.number().int().min(0).default(0).describe("Pagination offset."),
  limit: z.number().int().min(1).max(2000).default(100).describe("Page size (max 2000)."),
  sort: z
    .enum(["trip_start", "trip_end", "name"])
    .default("trip_start")
    .describe("Sort field."),
  sort_order: z.enum(["asc", "desc"]).default("asc").describe("Sort direction."),
};

export function searchTravelersHandler(client: TravelCodeApiClient) {
  return withImpersonation(
    async ({
      active,
      trip_from,
      trip_to,
      country_iso,
      q,
      order_status,
      offset,
      limit,
      sort,
      sort_order,
    }: {
      active?: boolean;
      trip_from?: string;
      trip_to?: string;
      country_iso?: string;
      q?: string;
      order_status?: string;
      offset: number;
      limit: number;
      sort: "trip_start" | "trip_end" | "name";
      sort_order: "asc" | "desc";
    }) => {
      try {
        const data = await client.get<TravelersListResponse>("/travelers", {
          active,
          trip_from,
          trip_to,
          country_iso,
          q,
          order_status,
          offset,
          limit,
          sort,
          sort_order,
        });
        return {
          content: [{ type: "text" as const, text: formatTravelerList(data) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text" as const, text: `Error searching travelers: ${(error as Error).message}` },
          ],
          isError: true,
        };
      }
    },
  );
}

export function registerSearchTravelers(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "search_travelers",
    [
      "List corporate travelers currently on trips (duty-of-care view). Returns short rows with id, name, destination, trip window, and contact info. Pair with get_traveler for full details.",
      "",
      "USER-FACING LANGUAGE: speak about 'travelers', 'people on trips', 'employees currently abroad'. Never quote internal labels, REST routes, error codes, or numeric ids.",
      "",
      "When to call:",
      "  • 'Who is travelling right now / this week?' → set active=true or pass a trip_from/trip_to window.",
      "  • 'Who is in <country>?' → country_iso with ISO-3 code.",
      "  • Search by name or email → q (min 2 chars).",
      "",
      "Visibility: an admin sees everyone in the agency; a regular user sees only their own trips.",
    ].join("\n"),
    { ...searchTravelersSchema, ...impersonationInputSchema },
    searchTravelersHandler(client),
  );
}
