import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { NotificationIntegrationsResponse } from "../client/types.js";
import { formatIntegrationsList } from "../formatters/notifications-formatter.js";

export const listNotificationIntegrationsSchema = {
  status: z
    .enum(["active", "inactive"])
    .optional()
    .describe("Optional filter — only return channels that are currently active or currently inactive."),
  lang: z.enum(["en", "ru"]).default("en").describe("Language for channel titles."),
};

export function registerListNotificationIntegrations(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "list_notification_integrations",
    [
      "Show which notification channels (Email, Telegram, Slack) are set up for the user and whether they are currently active.",
      "",
      "USER-FACING LANGUAGE: speak in plain words ('your Telegram is connected', 'Slack is set up but turned off', 'Email is always on'). Never quote internal field names, REST routes, or error codes.",
      "",
      "Use this before suggesting connect/disconnect/activate. Email is always active and cannot be disconnected.",
    ].join("\n"),
    listNotificationIntegrationsSchema,
    async ({ status, lang }) => {
      try {
        const data = await client.get<NotificationIntegrationsResponse>(
          "/notifications/integrations",
          { status, lang },
        );
        return { content: [{ type: "text", text: formatIntegrationsList(data) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error listing notification channels: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
