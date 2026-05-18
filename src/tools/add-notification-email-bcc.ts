import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { EmailBccMutationResponse } from "../client/types.js";
import { formatBccAdd } from "../formatters/notifications-formatter.js";

export const addNotificationEmailBccSchema = {
  group_code: z
    .string()
    .min(1)
    .describe(
      "Notification group code to attach the BCC address to (e.g. 'orders'). Use list_notification_email_bcc to see the valid groupCodes.",
    ),
  email: z
    .string()
    .min(3)
    .describe(
      "Email address to add as a BCC for this group. The server lowercases and trims it before saving.",
    ),
  lang: z.enum(["en", "ru"]).default("en").describe("Language for any human-readable fields."),
};

export function registerAddNotificationEmailBcc(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "add_notification_email_bcc",
    [
      "Add an extra email address as a BCC for one notification group (e.g. send accounting@acme.com a copy of every Orders email the user gets).",
      "",
      "USER-FACING LANGUAGE: speak about 'adding an extra email that will get copies of your order notifications'. Never quote internal field names, REST routes, or error codes.",
      "",
      "Behaviour:",
      "  • The new address is created in 'pending' state — it does NOT yet receive copies.",
      "  • No verification email is sent automatically; call send_notification_email_bcc_confirmation right after to email a verification link to the address.",
      "  • The owner of that mailbox must click the link to activate it.",
      "  • Max 5 addresses per group (pending+confirmed combined).",
      "  • Adding the same email twice in the same group is rejected as duplicate.",
      "  • The same email can be added independently to different groups; each group needs its own confirmation.",
    ].join("\n"),
    addNotificationEmailBccSchema,
    async ({ group_code, email, lang }) => {
      try {
        const data = await client.post<EmailBccMutationResponse>(
          `/notifications/integrations/email/bcc/${encodeURIComponent(group_code)}`,
          { email },
          { lang },
        );
        return { content: [{ type: "text", text: formatBccAdd(data) }] };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error adding BCC address: ${(error as Error).message}` },
          ],
          isError: true,
        };
      }
    },
  );
}
