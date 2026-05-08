import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { SlackInstallUrlResponse } from "../client/types.js";
import { formatSlackInstallUrl } from "../formatters/notifications-formatter.js";

export const getSlackInstallUrlSchema = {
  return_url: z
    .string()
    .url()
    .optional()
    .describe(
      "Optional URL to send the user back to after Slack authorization. Must match the user's company domain exactly (scheme + host + port); other URLs are rejected.",
    ),
  lang: z.enum(["en", "ru"]).default("en").describe("Language for any human-readable fields."),
};

export function registerGetSlackInstallUrl(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_slack_install_url",
    [
      "Produce a one-time Slack authorization URL the user must open in their browser to connect Slack.",
      "",
      "USER-FACING LANGUAGE: tell the user 'open this link to connect Slack'; do not paraphrase or rewrite the URL. The link is single-use and expires in ~10 minutes; calling this tool again issues a fresh link.",
      "",
      "The agent cannot complete the OAuth flow itself — once the user authorizes in the browser, poll get_slack_status (or list_notification_integrations) to confirm the connection.",
    ].join("\n"),
    getSlackInstallUrlSchema,
    async ({ return_url, lang }) => {
      try {
        const data = await client.get<SlackInstallUrlResponse>(
          "/notifications/integrations/slack/install-url",
          { returnUrl: return_url, lang },
        );
        return { content: [{ type: "text", text: formatSlackInstallUrl(data) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting Slack install link: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
