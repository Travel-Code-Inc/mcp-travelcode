import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { SlackStatus } from "../client/types.js";
import { formatSlackStatus } from "../formatters/notifications-formatter.js";

export const getSlackStatusSchema = {
  lang: z.enum(["en", "ru"]).default("en").describe("Language for any human-readable fields."),
};

export function registerGetSlackStatus(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_slack_status",
    [
      "Check whether the user's Slack is connected and return the linked Slack workspace name and id.",
      "",
      "USER-FACING LANGUAGE: speak about 'your Slack', 'workspace …'. Never quote internal labels or REST routes.",
    ].join("\n"),
    getSlackStatusSchema,
    async ({ lang }) => {
      try {
        const data = await client.get<SlackStatus>(
          "/notifications/integrations/slack/status",
          { lang },
        );
        return { content: [{ type: "text", text: formatSlackStatus(data) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error checking Slack status: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
