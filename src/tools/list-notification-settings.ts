import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { NotificationSettingsList } from "../client/types.js";
import { formatSettingsList } from "../formatters/notifications-formatter.js";

export const listNotificationSettingsSchema = {
  channel: z
    .enum(["email", "telegram", "slack"])
    .describe("Channel whose notification type toggles to list."),
  enabled: z
    .enum(["on", "off", "all"])
    .default("all")
    .describe("Filter the list — 'on' = only enabled types, 'off' = only disabled types, 'all' = both."),
  lang: z.enum(["en", "ru"]).default("en").describe("Language for titles."),
};

export function registerListNotificationSettings(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "list_notification_settings",
    [
      "List the notification types (events) the user can receive on a given channel — and which are currently on/off.",
      "",
      "USER-FACING LANGUAGE: speak about 'what gets sent to your Telegram', 'order updates', 'trip reminders'. Never quote typeCode strings, REST routes, or error codes.",
      "",
      "Pair with update_notification_setting to turn a specific type on or off. Use this to answer 'show me what notifications I get' or 'what kinds of notifications are there for slack'.",
    ].join("\n"),
    listNotificationSettingsSchema,
    async ({ channel, enabled, lang }) => {
      try {
        const data = await client.get<NotificationSettingsList>(
          `/notifications/integrations/${channel}/settings`,
          { enabled, lang },
        );
        return { content: [{ type: "text", text: formatSettingsList(data) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error listing ${channel} settings: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
