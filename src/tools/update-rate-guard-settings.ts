import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { RateGuardSettings } from "../client/types.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";
import { formatRateGuardSettings } from "../formatters/rate-guard-formatter.js";

const numericOrNull = z.union([z.number(), z.null()]).optional();
const intOrNull = z.union([z.number().int(), z.null()]).optional();

export const updateRateGuardSettingsSchema = {
  enabled: z.boolean().optional().describe("Master toggle for the rate-guard feature on this agency."),
  savingPercent: numericOrNull.describe(
    "Minimum savings in percent (0–100) to trigger rebook/notification. Pass null to reset to the platform default.",
  ),
  savingAmountUsd: numericOrNull.describe(
    "Minimum savings in USD (>=0). Pass null to reset to default.",
  ),
  maxEarlierCancelShiftDays: intOrNull.describe(
    "How many days earlier the new offer's free-cancellation deadline may fall vs the source (>=0). Pass null to reset.",
  ),
  minDaysBeforeCheckin: intOrNull.describe(
    "Minimum days before check-in for auto-rebook to be allowed (>=0). Pass null to reset.",
  ),
};

export function registerUpdateRateGuardSettings(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "update_rate_guard_settings",
    [
      "Update (upsert) the agency-level Rate Guard settings. Idempotent — only the fields present in the call are applied. Pass null in a numeric field to reset it to the platform default.",
      "",
      "USER-FACING LANGUAGE: 'update rate guard', 'savings threshold', 'cancel-deadline window'. Never quote internal field names or REST routes.",
      "",
      "Director role only — admins are not allowed by the REST layer. Operates on the currently active agency of the authenticated user.",
    ].join("\n"),
    { ...updateRateGuardSettingsSchema, ...impersonationInputSchema },
    withImpersonation(async (args) => {
      const body: Record<string, unknown> = {};
      const { enabled, savingPercent, savingAmountUsd, maxEarlierCancelShiftDays, minDaysBeforeCheckin } = args;

      if (enabled !== undefined) body.enabled = enabled;
      if (savingPercent !== undefined) body.savingPercent = savingPercent;
      if (savingAmountUsd !== undefined) body.savingAmountUsd = savingAmountUsd;
      if (maxEarlierCancelShiftDays !== undefined) body.maxEarlierCancelShiftDays = maxEarlierCancelShiftDays;
      if (minDaysBeforeCheckin !== undefined) body.minDaysBeforeCheckin = minDaysBeforeCheckin;

      if (Object.keys(body).length === 0) {
        return {
          content: [{ type: "text", text: "No fields to update. Pass at least one of enabled, savingPercent, savingAmountUsd, maxEarlierCancelShiftDays, minDaysBeforeCheckin." }],
          isError: true,
        };
      }

      try {
        const data = await client.put<RateGuardSettings>("/rate-guard/settings", body);
        return {
          content: [{ type: "text", text: formatRateGuardSettings(data) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error updating rate guard settings: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }),
  );
}
