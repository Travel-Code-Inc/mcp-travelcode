import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { TelegramStatus } from "../client/types.js";
import { formatTelegramStatus } from "../formatters/notifications-formatter.js";

export const getTelegramStatusSchema = {
  lang: z.enum(["en", "ru"]).default("en").describe("Language for any human-readable fields."),
};

export function registerGetTelegramStatus(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_telegram_status",
    [
      "Check whether the user's Telegram is connected, and return the linked Telegram username and chat id.",
      "",
      "USER-FACING LANGUAGE: speak about 'your Telegram', 'connected as @…'. Never quote internal labels or REST routes.",
      "",
      "Use this after init_telegram_link to poll until the user finishes linking in the Telegram app.",
    ].join("\n"),
    getTelegramStatusSchema,
    async ({ lang }) => {
      try {
        const data = await client.get<TelegramStatus>(
          "/notifications/integrations/telegram/status",
          { lang },
        );
        return { content: [{ type: "text", text: formatTelegramStatus(data) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error checking Telegram status: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
