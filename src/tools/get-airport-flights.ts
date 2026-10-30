import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { AirportBoardResponse } from "../client/types.js";
import { formatAirportBoard } from "../formatters/flight-stats-formatter.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const getAirportFlightsSchema = {
  airport_code: z
    .string()
    .describe("IATA airport code (e.g. 'JFK', 'LHR', 'WAW')"),
  direction: z
    .enum(["departure", "arrival"])
    .default("departure")
    .describe("Show departures or arrivals"),
  from_time: z
    .string()
    .describe("Start of time window in YYYY-MM-DDTHH:mm format (local airport time, e.g. '2026-02-15T08:00')"),
  to_time: z
    .string()
    .describe("End of time window in YYYY-MM-DDTHH:mm format (max 12 hours after from_time, e.g. '2026-02-15T14:00')"),
  include_codeshares: z
    .boolean()
    .default(false)
    .describe("Include codeshare flights (duplicates under different flight numbers)"),
  include_cargo: z
    .boolean()
    .default(false)
    .describe("Include cargo flights"),
};

export function registerGetAirportFlights(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_airport_flights",
    "Get the departure or arrival board for an airport within a time window (max 12 hours). Shows all flights with their status, terminals, and gates. Use this to monitor departures/arrivals or check for widespread delays.",
    getAirportFlightsSchema,
    READ_ONLY_TOOL,
    async ({ airport_code, direction, from_time, to_time, include_codeshares, include_cargo }) => {
      try {
        // Validate time window (max 12 hours)
        const from = new Date(from_time);
        const to = new Date(to_time);
        const diffHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);

        if (diffHours > 12) {
          return {
            content: [{
              type: "text",
              text: "Error: Time window must not exceed 12 hours. Please narrow the range.",
            }],
            isError: true,
          };
        }

        if (diffHours <= 0) {
          return {
            content: [{
              type: "text",
              text: "Error: to_time must be after from_time.",
            }],
            isError: true,
          };
        }

        const code = airport_code.toUpperCase();
        const board = await client.getFlightStats<AirportBoardResponse>(
          `/flights/airports/iata/${encodeURIComponent(code)}/${from_time}/${to_time}`,
          {
            withCancellations: true,
            withCodeshares: include_codeshares,
            withCargo: include_cargo,
            withPrivate: false,
            direction,
          }
        );

        const flights = direction === "departure" ? board.departures || [] : board.arrivals || [];

        return {
          content: [{
            type: "text",
            text: formatAirportBoard(flights, code, direction, from_time, to_time),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error getting airport flights for ${airport_code}: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    }
  );
}
