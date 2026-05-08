import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { NotificationSettingDetail } from "../client/types.js";
import { formatSettingDetail } from "../formatters/notifications-formatter.js";

export const getNotificationSettingSchema = {
  channel: z
    .enum(["email", "telegram", "slack"])
    .describe("Channel the setting belongs to."),
  type_code: z
    .string()
    .describe("Notification type identifier (e.g. 'order_notification_for_customer'). Get valid values from list_notification_settings."),
  lang: z.enum(["en", "ru"]).default("en").describe("Language for titles."),
};

export function registerGetNotificationSetting(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_notification_setting",
    [
      "Read a single notification-type toggle for a channel (the effective on/off value for the user).",
      "",
      "USER-FACING LANGUAGE: speak about 'order updates on Telegram', 'trip reminders on Slack'. Never quote typeCode strings, REST routes, or error codes.",
    ].join("\n"),
    getNotificationSettingSchema,
    async ({ channel, type_code, lang }) => {
      try {
        const data = await client.get<NotificationSettingDetail>(
          `/notifications/integrations/${channel}/settings/${encodeURIComponent(type_code)}`,
          { lang },
        );
        return { content: [{ type: "text", text: formatSettingDetail(data) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error reading ${channel} setting: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
