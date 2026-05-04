import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { TravelCodeConfig } from "../config.js";
import { FlightSearchRequest } from "../client/types.js";
import { executeFlightSearch, type ProgressCallback } from "../polling/flight-poller.js";
import { formatFlightResults } from "../formatters/flight-formatter.js";
import type { ServerNotification } from "@modelcontextprotocol/sdk/types.js";

function convertDate(isoDate: string): string {
  // YYYY-MM-DD → DD.MM.YYYY
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

export const searchFlightsSchema = {
  origin: z.string().describe("Departure airport or city IATA code (e.g. 'LHR', 'LON', 'JFK'). Use search_airports to find codes."),
  destination: z.string().describe("Arrival airport or city IATA code (e.g. 'CDG', 'BCN', 'NYC'). Use search_airports to find codes."),
  departure_date: z.string().describe("Departure date in YYYY-MM-DD format (e.g. '2026-03-15')"),
  return_date: z.string().optional().describe("Return date in YYYY-MM-DD format for round-trip. Omit for one-way."),
  cabin_class: z
    .enum(["economy", "premium_economy", "business", "first"])
    .default("economy")
    .describe("Cabin class"),
  adults: z.number().int().min(1).max(9).default(1).describe("Number of adult passengers"),
  children: z.number().int().min(0).max(9).default(0).describe("Number of children (2-11 years)"),
  infants: z.number().int().min(0).max(4).default(0).describe("Number of infants (under 2 years)"),
  preferred_airlines: z
    .array(z.string())
    .optional()
    .describe("Optional list of preferred airline IATA codes to filter results (e.g. ['BA', 'LH'])"),
};

export function registerSearchFlights(server: McpServer, client: TravelCodeApiClient, config: TravelCodeConfig) {
  server.tool(
    "search_flights",
    [
      "Search for flights between two airports. Handles the full search process including waiting for results from multiple airline sources. May take 15-60 seconds. For round-trip, provide both departure and return dates. Returns top results sorted by price with a cache ID for follow-up filtering.",
      "",
      "Role-based behavior (from get_current_user — call it once at the start of the session and reuse):",
      "  • role = 'employee_traveller': force `adults=1, children=0, infants=0`. Refuse multi-passenger searches. Call get_first_client to load the user's only tourist; reuse them at create_order.",
      "  • role = 'developer': prefix the user-facing reply with '[Developer mode]' so the user always sees the search ran in dev mode.",
    ].join("\n"),
    searchFlightsSchema,
    async ({ origin, destination, departure_date, return_date, cabin_class, adults, children, infants, preferred_airlines }, extra) => {
      try {
        const searchParams: FlightSearchRequest = {
          locationFrom: origin.toUpperCase(),
          locationTo: destination.toUpperCase(),
          date: convertDate(departure_date),
          dateEnd: return_date ? convertDate(return_date) : "",
          cabinClass: cabin_class,
          adults,
          children,
          infants,
        };

        if (preferred_airlines && preferred_airlines.length > 0) {
          searchParams.airlines = preferred_airlines.map((a) => a.toUpperCase());
        }

        // Build progress callback using MCP progress notifications
        const progressToken = extra._meta?.progressToken;
        let onProgress: ProgressCallback | undefined;
        if (progressToken !== undefined) {
          onProgress = async (progress: number, total: number, message: string) => {
            await extra.sendNotification({
              method: "notifications/progress",
              params: { progressToken, progress, total, message },
            } as ServerNotification);
          };
        }

        const result = await executeFlightSearch(client, searchParams, config, onProgress);

        // Build passengers description
        const parts: string[] = [];
        if (adults > 0) parts.push(`${adults} adult${adults > 1 ? "s" : ""}`);
        if (children > 0) parts.push(`${children} child${children > 1 ? "ren" : ""}`);
        if (infants > 0) parts.push(`${infants} infant${infants > 1 ? "s" : ""}`);

        const text = formatFlightResults(result.response, result.cacheId, {
          origin: origin.toUpperCase(),
          destination: destination.toUpperCase(),
          departureDate: departure_date,
          returnDate: return_date,
          cabinClass: cabin_class,
          passengers: parts.join(", "),
        }, result.completed);

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error searching flights: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
