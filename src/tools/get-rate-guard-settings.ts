import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { RateGuardSettings } from "../client/types.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";
import { formatRateGuardSettings } from "../formatters/rate-guard-formatter.js";

export const getRateGuardSettingsSchema = {};

export function registerGetRateGuardSettings(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_rate_guard_settings",
    [
      "Return the agency-level Rate Guard settings (auto-rebook thresholds) for the currently active agency of the authenticated user. Director role only — admins are not allowed by the REST layer.",
      "",
      "USER-FACING LANGUAGE: speak about 'rate guard', 'savings threshold', 'check-in window'. Never quote internal field names or REST routes.",
      "",
      "Settings cover: master toggle, minimum savings in percent, minimum savings in USD, how many days earlier the new offer's free-cancellation deadline may fall vs the original, and the minimum days before check-in for auto-rebook. Defaults are returned alongside effective values so the UI/LLM can show placeholders.",
    ].join("\n"),
    { ...getRateGuardSettingsSchema, ...impersonationInputSchema },
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
