import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { EmailBccDeleteResponse } from "../client/types.js";
import { formatBccDelete } from "../formatters/notifications-formatter.js";

export const deleteNotificationEmailBccSchema = {
  group_code: z
    .string()
    .min(1)
    .describe("Notification group code the address belongs to (e.g. 'orders')."),
  bcc_id: z
    .number()
    .int()
    .positive()
    .describe(
      "Numeric id of the BCC address to remove (returned by add_notification_email_bcc or list_notification_email_bcc).",
    ),
  lang: z.enum(["en", "ru"]).default("en").describe("Language for any human-readable fields."),
};

export function registerDeleteNotificationEmailBcc(
  server: McpServer,
  client: TravelCodeApiClient,
) {
  server.tool(
    "delete_notification_email_bcc",
    [
      "DESTRUCTIVE: remove a BCC email address from a notification group. There is no 'disable' — removing is the only way to stop copies.",
      "",
      "USER-FACING LANGUAGE: confirm in plain words before calling — 'this will stop sending copies of your orders to accounting@acme.com'. Never quote internal field names, REST routes, or error codes.",
      "",
      "Behaviour:",
      "  • Works on both pending and confirmed addresses.",
      "  • Any unused verification link previously emailed for this address becomes invalid.",
      "  • Removing does not free the address for re-add limits — re-adding the same email later starts the verification flow from scratch.",
    ].join("\n"),
    deleteNotificationEmailBccSchema,
    async ({ group_code, bcc_id, lang }) => {
      try {
        await client.delete<EmailBccDeleteResponse>(
          `/notifications/integrations/email/bcc/${encodeURIComponent(group_code)}/${bcc_id}`,
          { lang },
        );
        return {
          content: [{ type: "text", text: formatBccDelete(group_code, bcc_id) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error removing BCC address: ${(error as Error).message}` },
          ],
          isError: true,
        };
      }
    },
  );
}
