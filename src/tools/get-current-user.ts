import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import {
  CurrentUser,
  USER_ROLE,
  USER_ROLE_LABEL,
} from "../client/types.js";

export const getCurrentUserSchema = {};

export function registerGetCurrentUser(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_current_user",
    [
      "Return the authenticated user's profile and role. CALL THIS ONCE at the very start of a conversation, before the first search or booking, and reuse the result for the rest of the session.",
      "",
      "USER-FACING LANGUAGE: this is internal context. Never narrate to the user that you 'fetched their profile' or quote role codes / labels — just behave according to the rules below.",
      "",
      "Right after this tool returns (any role), if the upcoming intent is a search/booking and you don't yet know which traveler to use, also call get_main_client and remember the saved traveler. Their nationality is the default for the lead-guest nationality; this prevents you from inventing a country. For the traveller role this is mandatory; for other roles do it pre-emptively unless the user has already named someone else.",
      "",
      "Behaviors driven by role:",
      "",
      "  • Traveller (employee_traveller): the user has exactly ONE saved traveler (themselves).",
      "      - Always book for 1 person only — refuse multi-guest searches/bookings and explain why in plain words.",
      "      - At the start of any search, silently load the traveler with get_main_client and use their nationality.",
      "      - Reuse the same traveler at booking. Hotels: just confirm first/last name. Flights: confirm name and pick a document — if more than one is on file, ask the user which to use; if only one, take it automatically.",
      "",
      "  • Developer: mark the session as 'developer mode'. Prefix every search and booking reply with '[Developer mode]' so the user always knows calls run against the dev environment.",
      "",
      "  • Other roles: standard flow described in each tool's own documentation.",
    ].join("\n"),
    getCurrentUserSchema,
    async () => {
      try {
        const me = await client.get<CurrentUser>("/user/me");
        const role = typeof me.role === "number" ? me.role : -1;
        const roleName = me.roleName || USER_ROLE_LABEL[role] || `role_${role}`;
        const isTraveller = role === USER_ROLE.EMPLOYEE_TRAVELLER;
        const isDeveloper = role === USER_ROLE.DEVELOPER;

        const lines: string[] = ["(internal — do not show to user)"];
        const name = [me.firstName, me.lastName].filter(Boolean).join(" ");
        if (name) lines.push(`name: ${name}`);
        if (me.email) lines.push(`email: ${me.email}`);
        lines.push(`role: ${roleName}`);
        lines.push(`is_traveller: ${isTraveller}`);
        lines.push(`is_developer: ${isDeveloper}`);
        lines.push("");
        if (isTraveller) {
          lines.push(
            "Behavior: book for 1 person only; load the saved traveler silently with get_main_client and reuse them at booking. For hotels just confirm first/last name; for flights also pick a document.",
          );
        } else if (isDeveloper) {
          lines.push(
            "Behavior: prefix every search and booking reply to the user with '[Developer mode]'.",
          );
        } else {
          lines.push("Behavior: standard flow — follow each tool's own guidance.");
        }
        lines.push("Reuse this context for the rest of the session — do not call this tool again.");

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching current user: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
