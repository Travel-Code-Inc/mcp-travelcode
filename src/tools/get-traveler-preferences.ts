import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { TravelerPreferences } from "../client/types.js";
import { formatPreferences } from "../formatters/preferences-formatter.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const getTravelerPreferencesSchema = {};

export function registerGetTravelerPreferences(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_traveler_preferences",
    [
      "Return the user's saved travel preferences — flight (seat, meal, preferred airlines, stops, departure time), hotel (room type, smoking, meal plan), special needs (dietary, accessibility), default nationality, frequent destinations, and default flight/hotel sort.",
      "",
      "USER-FACING LANGUAGE: speak about 'your saved preferences'. Never quote internal keys, REST routes, or error codes.",
      "",
      "When to call: before a flight/hotel search or booking, to tailor options — bias search_flights / search_hotels toward the preferred seat, meal, airline, stops, departure time, room type, meal plan and smoking choice, prefill nationality, lean on frequent destinations and the default sort, and always honor dietary and accessibility needs. Call once and reuse for the session.",
      "",
      "Impersonation: if the upcoming search/booking runs with actAs=<email> (admin acting for another user), call this tool with the SAME actAs (and actAsCompanyId when set) so you read the TARGET user's preferences, not the admin's.",
      "",
      "If nothing is saved, the tool says so — proceed without assumptions and ask the user when a choice matters.",
    ].join("\n"),
    { ...getTravelerPreferencesSchema, ...impersonationInputSchema },
    READ_ONLY_TOOL,
    withImpersonation(async () => {
      try {
        const data = await client.get<TravelerPreferences>("/user/preferences");
        return { content: [{ type: "text", text: formatPreferences(data) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting preferences: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }),
  );
}
