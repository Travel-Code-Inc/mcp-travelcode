import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { RateGuardSettings } from "../client/types.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";
import { formatRateGuardSettings } from "../formatters/rate-guard-formatter.js";
import { DESTRUCTIVE_WRITE_TOOL } from "../util/tool-annotations.js";

const numericOrNull = z.union([z.number(), z.null()]).optional();
const intOrNull = z.union([z.number().int(), z.null()]).optional();

const sectionSchema = z
  .object({
    enabled: z.boolean().optional().describe("On/off toggle for this section."),
    savingPercent: numericOrNull.describe(
      "Minimum savings in percent (0–100). Pass null to reset to the platform default.",
    ),
    savingAmountUsd: numericOrNull.describe("Minimum savings in USD (>=0). Pass null to reset to default."),
    maxEarlierCancelShiftDays: intOrNull.describe(
      "How many days earlier the new offer's free-cancellation deadline may fall vs the source (>=0). Pass null to reset.",
    ),
    minDaysBeforeCheckin: intOrNull.describe("Minimum days before check-in (>=0). Pass null to reset."),
  })
  .optional();

export const updateRateGuardSettingsSchema = {
  email: sectionSchema.describe(
    "Email-notifications section — notifies the traveller and booking manager when a cheaper rate appears. Turning it off also silences the notification-center entries.",
  ),
  autoRebook: sectionSchema.describe(
    "Auto-rebook section — automatically rebooks the cheaper rate and cancels the original booking when safe. Applies only to bookings up to $1000.",
  ),
};

export function registerUpdateRateGuardSettings(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "update_rate_guard_settings",
    [
      "Update (upsert) the agency-level Rate Guard settings. Idempotent — only the sections/fields present in the call are applied. Pass null in a numeric field to reset it to the platform default.",
      "",
      "Settings are split into two sections: 'email' (notifications) and 'autoRebook'. Provide either or both; within a section provide only the fields you want to change.",
      "",
      "USER-FACING LANGUAGE: 'update rate guard', 'savings threshold', 'cancel-deadline window'. Never quote internal field names or REST routes.",
      "",
      "Editing requires a Pro plan or an admin role; otherwise the REST layer returns a permission error. Operates on the currently active agency of the authenticated user.",
    ].join("\n"),
    { ...updateRateGuardSettingsSchema, ...impersonationInputSchema },
    DESTRUCTIVE_WRITE_TOOL,
    withImpersonation(async (args) => {
      const { email, autoRebook } = args;
      const body: Record<string, unknown> = {};

      if (email !== undefined) body.email = email;
      if (autoRebook !== undefined) body.autoRebook = autoRebook;

      if (Object.keys(body).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No fields to update. Pass an 'email' and/or 'autoRebook' object with at least one field (enabled, savingPercent, savingAmountUsd, maxEarlierCancelShiftDays, minDaysBeforeCheckin).",
            },
          ],
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
