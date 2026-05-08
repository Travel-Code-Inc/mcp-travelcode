import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { NotificationUpdateResponse } from "../client/types.js";
import { formatSettingUpdate } from "../formatters/notifications-formatter.js";

export const updateNotificationSettingSchema = {
  channel: z
    .enum(["email", "telegram", "slack"])
    .describe("Channel the setting belongs to."),
  type_code: z
    .string()
    .describe("Notification type identifier (e.g. 'order_notification_for_customer'). Get valid values from list_notification_settings."),
  value: z
    .boolean()
    .describe("Turn the notification type on (true) or off (false)."),
  lang: z.enum(["en", "ru"]).default("en").describe("Language for any human-readable fields."),
};

export function registerUpdateNotificationSetting(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "update_notification_setting",
    [
      "Turn a single notification type on or off for a channel.",
      "",
      "USER-FACING LANGUAGE: speak about 'turning order updates on for Telegram', 'turning trip reminders off for Slack'. Never quote typeCode strings, REST routes, or error codes.",
      "",
      "Confirm with the user in plain words before turning OFF anything they care about — silenced notifications can mean missed bookings.",
    ].join("\n"),
    updateNotificationSettingSchema,
    async ({ channel, type_code, value, lang }) => {
      try {
        const data = await client.patch<NotificationUpdateResponse>(
          `/notifications/integrations/${channel}/settings/${encodeURIComponent(type_code)}`,
          { value },
          { lang },
        );
        return { content: [{ type: "text", text: formatSettingUpdate(data) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error updating ${channel} setting: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
