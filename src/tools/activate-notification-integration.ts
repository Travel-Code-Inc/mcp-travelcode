import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { NotificationToggleResponse } from "../client/types.js";
import { formatActivate } from "../formatters/notifications-formatter.js";

export const activateNotificationIntegrationSchema = {
  channel: z
    .enum(["telegram", "slack"])
    .describe(
      "Channel to re-enable. Must already have credentials saved (status 'inactive'). Email is always active and not accepted here.",
    ),
  lang: z.enum(["en", "ru"]).default("en").describe("Language for any human-readable fields."),
};

export function registerActivateNotificationIntegration(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "activate_notification_integration",
    [
      "Turn back on a notification channel that the user previously turned off but still has connected (status 'inactive').",
      "",
      "USER-FACING LANGUAGE: speak about 'turning Telegram/Slack back on'. Never quote internal labels, REST routes, or error codes.",
      "",
      "If the channel was never connected (status 'not_connected'), this will fail — start a connection flow with init_telegram_link or get_slack_install_url instead. Calling on an already-active channel is a safe no-op.",
    ].join("\n"),
    activateNotificationIntegrationSchema,
    async ({ channel, lang }) => {
      try {
        await client.post<NotificationToggleResponse>(
          `/notifications/integrations/${channel}/activate`,
          {},
          { lang },
        );
        return { content: [{ type: "text", text: formatActivate(channel) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error activating ${channel}: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
