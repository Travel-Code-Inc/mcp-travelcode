import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { TelegramInitResponse } from "../client/types.js";
import { formatTelegramInit } from "../formatters/notifications-formatter.js";

export const initTelegramLinkSchema = {
  lang: z.enum(["en", "ru"]).default("en").describe("Language for any human-readable fields."),
};

export function registerInitTelegramLink(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "init_telegram_link",
    [
      "Start a Telegram linking flow — returns a single-use t.me deep link the user opens and presses Start in the Telegram app.",
      "",
      "USER-FACING LANGUAGE: tell the user 'open this link in Telegram and press Start'; do not paraphrase or rewrite the URL. Calling again issues a fresh link.",
      "",
      "The agent cannot complete the link itself. After the user presses Start, poll get_telegram_status until connected.",
    ].join("\n"),
    initTelegramLinkSchema,
    async ({ lang }) => {
      try {
        const data = await client.post<TelegramInitResponse>(
          "/notifications/integrations/telegram/init",
          {},
          { lang },
        );
        return { content: [{ type: "text", text: formatTelegramInit(data) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error starting Telegram link: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
