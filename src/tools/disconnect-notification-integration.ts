import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { NotificationToggleResponse } from "../client/types.js";
import { formatDisconnect } from "../formatters/notifications-formatter.js";

export const disconnectNotificationIntegrationSchema = {
  channel: z
    .enum(["telegram", "slack"])
    .describe("Channel to disconnect. Email cannot be disconnected — the API rejects it."),
  lang: z.enum(["en", "ru"]).default("en").describe("Language for any human-readable fields."),
};

export function registerDisconnectNotificationIntegration(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "disconnect_notification_integration",
    [
      "DESTRUCTIVE: clear the credentials for a notification channel and turn it off.",
      "",
      "USER-FACING LANGUAGE: speak about 'disconnecting Telegram/Slack'. Always confirm with the user in plain words before calling — they will lose the connection until they re-link.",
      "",
      "Side effects:",
      "  • Telegram — the bot sends the user a 'notifications disabled' message in their chat.",
      "  • Slack — credentials are cleared on our side; the workspace install at Slack itself is NOT revoked (a workspace admin must do that in Slack's UI).",
      "  • Email — the API rejects this; tell the user that Email is always on.",
      "",
      "Calling on an already-disconnected channel is a safe no-op.",
    ].join("\n"),
    disconnectNotificationIntegrationSchema,
    async ({ channel, lang }) => {
      try {
        await client.delete<NotificationToggleResponse>(
          `/notifications/integrations/${channel}`,
          { lang },
        );
        return { content: [{ type: "text", text: formatDisconnect(channel) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error disconnecting ${channel}: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
