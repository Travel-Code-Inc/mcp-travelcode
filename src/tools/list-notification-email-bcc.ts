import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { EmailBccListResponse } from "../client/types.js";
import { formatBccList } from "../formatters/notifications-formatter.js";

export const listNotificationEmailBccSchema = {
  lang: z.enum(["en", "ru"]).default("en").describe("Language for group titles."),
};

export function registerListNotificationEmailBcc(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "list_notification_email_bcc",
    [
      "List the user's per-group BCC email addresses for the Email channel.",
      "",
      "BCC addresses receive a hidden copy of every notification email sent to the user inside that group (e.g. 'orders'). They never receive copies of emails addressed to guests or tourists.",
      "",
      "Each address is either 'pending' (added but not yet verified) or 'confirmed' (the owner of that mailbox clicked the verification link). Only confirmed addresses actually get copies — pending addresses are ignored by the mailer until they confirm.",
      "",
      "USER-FACING LANGUAGE: speak about 'extra email copies for your orders', 'this address is waiting for the owner to confirm', 'this address is active and getting copies'. Never quote internal field names, REST routes, or error codes.",
      "",
      "Use this before suggesting add/remove/resend — it returns the bccId you need for the other tools, plus the next allowed time if a confirmation re-send is rate-limited.",
    ].join("\n"),
    listNotificationEmailBccSchema,
    async ({ lang }) => {
      try {
        const data = await client.get<EmailBccListResponse>(
          "/notifications/integrations/email/bcc",
          { lang },
        );
        return { content: [{ type: "text", text: formatBccList(data) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error listing email BCC: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
