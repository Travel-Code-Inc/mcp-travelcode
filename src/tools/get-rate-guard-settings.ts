import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { RateGuardSettings } from "../client/types.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";
import { formatRateGuardSettings } from "../formatters/rate-guard-formatter.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const getRateGuardSettingsSchema = {};

export function registerGetRateGuardSettings(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_rate_guard_settings",
    [
      "Return the agency-level Rate Guard settings for the currently active agency of the authenticated user. Available to travel-management roles (director / travel manager) and admin roles; rank-and-file employees are blocked by the REST layer.",
      "",
      "USER-FACING LANGUAGE: speak about 'rate guard', 'savings threshold', 'check-in window'. Never quote internal field names or REST routes.",
      "",
      "Settings are split into two independent sections — 'Email notifications' and 'Auto rebook' — each with: on/off toggle, minimum savings in percent, minimum savings in USD, how many days earlier the new offer's free-cancellation deadline may fall vs the original, and the minimum days before check-in. Defaults are returned per section alongside the effective values. The response also carries whether the current user may edit (Pro plan / admin) or only view.",
    ].join("\n"),
    { ...getRateGuardSettingsSchema, ...impersonationInputSchema },
    READ_ONLY_TOOL,
    withImpersonation(async () => {
      try {
        const data = await client.get<RateGuardSettings>("/rate-guard/settings");
        return {
          content: [{ type: "text", text: formatRateGuardSettings(data) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching rate guard settings: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }),
  );
}
