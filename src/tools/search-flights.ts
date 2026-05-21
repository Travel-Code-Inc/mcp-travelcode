import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { TravelCodeConfig } from "../config.js";
import { FlightSearchRequest } from "../client/types.js";
import { executeFlightSearch, type ProgressCallback } from "../polling/flight-poller.js";
import { formatFlightResults } from "../formatters/flight-formatter.js";
import type { ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";

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
      "Search for flights between two airports. Handles the full search including the wait for results from multiple airlines (15–60 seconds). For round-trip, provide both departure and return dates.",
      "",
      "USER-FACING LANGUAGE (mandatory):",
      "  • Speak in plain language: 'this flight', 'the cheapest option', 'departure / return', 'baggage included'. Never expose internal labels: search reference, cache id, parameter names, REST routes, error codes.",
      "  • The block marked '(internal — do not show to user)' is for downstream tool calls only. Never quote or mention it.",
      "",
      "Lead-passenger profile — STRICT rules, no shortcuts:",
      "  • Nationality is part of the booking and must match the document used at create_order. NEVER invent or assume a default nationality (no 'RU', no UI-language guess, no destination country).",
      "  • Before the first flight search of the session, if you don't already know the lead passenger, call get_main_client and remember the saved traveler — reuse them at booking. Do not ask the user for nationality before you have tried this. (For the traveller role this is mandatory and must be silent.)",
      "  • Only if get_main_client returns no traveler, ask the user before booking. The search itself can run on counts (adults/children/infants) without a nationality, but the booking cannot.",
      "  • Impersonation note: if you are calling this tool with actAs=<email>, you MUST call get_main_client with the SAME actAs so you read the TARGET user's saved traveler — not your own. The same applies to actAsCompanyId when set.",
      "  • Cache-invalidation: if get_main_client was already called earlier in this session WITHOUT actAs (e.g. at session start) and you now have an actAs, DO NOT reuse the earlier result. Refetch get_main_client with the new actAs — the previous result is the admin's profile and is wrong for the target user.",
      "",
      "Role rules (from get_current_user, called once per session):",
      "  • Traveller (employee_traveller): force 1 adult, 0 children, 0 infants. Refuse multi-passenger searches. Use get_main_client to load the only saved traveler; reuse them at booking.",
      "  • Developer: prefix the user-facing reply with '[Developer mode]'.",
    ].join("\n"),
    { ...searchFlightsSchema, ...impersonationInputSchema },
    withImpersonation(async ({ origin, destination, departure_date, return_date, cabin_class, adults, children, infants, preferred_airlines }, extra: { _meta?: { progressToken?: string | number }; sendNotification: (n: ServerNotification) => Promise<void> }) => {
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
    })
  );
}
