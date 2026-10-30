import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { FlightStatusResponse } from "../client/types.js";
import { formatFlightStatus } from "../formatters/flight-stats-formatter.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const getFlightStatusSchema = {
  flight_number: z
    .string()
    .describe("Flight number including airline code (e.g. 'LO776', 'BA304', 'LH1234')"),
  date: z
    .string()
    .describe("Flight date in YYYY-MM-DD format (e.g. '2026-02-15')"),
  with_aircraft_image: z
    .boolean()
    .default(false)
    .describe("Include aircraft image URL in the response"),
  with_location: z
    .boolean()
    .default(false)
    .describe("Include current aircraft position if in-flight"),
};

export function registerGetFlightStatus(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_flight_status",
    "Get real-time status of a specific flight by flight number and date. Returns departure/arrival times (scheduled, actual, estimated), terminals, gates, aircraft info, and delay information. Use this to check if a flight is on time, delayed, or cancelled.",
    getFlightStatusSchema,
    READ_ONLY_TOOL,
    async ({ flight_number, date, with_aircraft_image, with_location }) => {
      try {
        const normalized = flight_number.replace(/\s+/g, "").toUpperCase();
        const flights = await client.getFlightStats<FlightStatusResponse>(
          `/flights/number/${encodeURIComponent(normalized)}/${date}`,
          {
            withAircraftImage: with_aircraft_image,
            withLocation: with_location,
          }
        );

        return {
          content: [{ type: "text", text: formatFlightStatus(flights, normalized, date) }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error getting flight status for "${flight_number}" on ${date}: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    }
  );
}
