import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { EmailBccMutationResponse } from "../client/types.js";
import { formatBccSendConfirmation } from "../formatters/notifications-formatter.js";

export const sendNotificationEmailBccConfirmationSchema = {
  group_code: z
    .string()
    .min(1)
    .describe("Notification group code the address belongs to (e.g. 'orders')."),
  bcc_id: z
    .number()
    .int()
    .positive()
    .describe(
      "Numeric id of the BCC address (returned by add_notification_email_bcc or list_notification_email_bcc).",
    ),
  lang: z.enum(["en", "ru"]).default("en").describe("Language for any human-readable fields."),
};

export function registerSendNotificationEmailBccConfirmation(
  server: McpServer,
  client: TravelCodeApiClient,
) {
  server.tool(
    "send_notification_email_bcc_confirmation",
    [
      "Email a verification link to a pending BCC address so its owner can activate it.",
      "",
      "USER-FACING LANGUAGE: speak about 'sending a verification email to that address — they need to click the link to start getting copies'. Never quote internal field names, REST routes, or error codes.",
      "",
      "Behaviour:",
      "  • A fresh 7-day verification token is created; any previous unused token for this address is invalidated.",
      "  • A confirmation email is queued to the address. The owner must open it and click 'Confirm'.",
      "  • Calling this on an already-confirmed address fails — the address is already active.",
      "  • Rate-limited: 60s cooldown between re-sends for the same address, 10 confirmation emails/day per recipient email, 50/day per user. On 429 the API responds with 'Too many confirmation requests, try again later' — wait, then call list_notification_email_bcc to see the next allowed time.",
    ].join("\n"),
    sendNotificationEmailBccConfirmationSchema,
    async ({ group_code, bcc_id, lang }) => {
      try {
        const data = await client.post<EmailBccMutationResponse>(
          `/notifications/integrations/email/bcc/${encodeURIComponent(group_code)}/${bcc_id}/send-confirmation`,
          {},
          { lang },
        );
        return {
          content: [{ type: "text", text: formatBccSendConfirmation(data) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error sending BCC confirmation: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
