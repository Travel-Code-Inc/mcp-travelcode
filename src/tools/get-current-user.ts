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
      "The role drives several mandatory behaviors that the other tools rely on:",
      "",
      "  • role = 'employee_traveller' (Тревелер): the user has access to exactly ONE tourist record (themselves).",
      "      - Always book for 1 person only — refuse multi-guest searches/bookings up front and explain why.",
      "      - At the start of any search call get_first_client and use that traveler's nationality automatically (no need to ask).",
      "      - Reuse the same traveler at create_order. For HOTELS: just confirm first/last name with the user before booking, no other questions. For FLIGHTS: confirm name and, if the traveler has multiple documents, ask which one to use; otherwise auto-pick the only document.",
      "",
      "  • role = 'developer': mark the session as 'developer mode'. At the start of every search and at the start of every booking response, prefix the message with a clear marker like '[Developer mode]' so the user always knows the call is going against the dev environment / dev account.",
      "",
      "  • Other roles: standard flow described in each tool's own documentation.",
      "",
      "Return shape: { id, role (numeric), roleName (e.g. 'employee_traveller', 'developer', 'director', 'employee', ...), firstName, lastName, email, agencyId, isTraveller, isDeveloper }.",
    ].join("\n"),
    getCurrentUserSchema,
    async () => {
      try {
        const me = await client.get<CurrentUser>("/user/me");
        const role = typeof me.role === "number" ? me.role : -1;
        const roleName = me.roleName || USER_ROLE_LABEL[role] || `role_${role}`;
        const isTraveller = role === USER_ROLE.EMPLOYEE_TRAVELLER;
        const isDeveloper = role === USER_ROLE.DEVELOPER;

        const lines: string[] = [];
        lines.push(`User #${me.id} — role: ${roleName} (${role})`);
        const name = [me.firstName, me.lastName].filter(Boolean).join(" ");
        if (name) lines.push(`Name: ${name}`);
        if (me.email) lines.push(`Email: ${me.email}`);
        if (me.agencyId !== undefined) lines.push(`Agency id: ${me.agencyId}`);

        lines.push("");
        if (isTraveller) {
          lines.push(
            "MODE: traveller — book for 1 person only, always reuse the user's default tourist (get_first_client). Hotels: only confirm name/lastname before booking. Flights: also pick a document if the tourist has multiple.",
          );
        } else if (isDeveloper) {
          lines.push(
            "MODE: developer — prefix every search and booking response with '[Developer mode]' so the user always sees that calls go against the dev environment.",
          );
        } else {
          lines.push("MODE: standard — follow each tool's own guidance.");
        }

        lines.push("");
        lines.push(
          `Flags: isTraveller=${isTraveller}, isDeveloper=${isDeveloper}. Reuse this for the rest of the session — do not call get_current_user again.`,
        );

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
