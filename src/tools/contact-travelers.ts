import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import {
  ContactTravelersRequest,
  ContactTravelersResponse,
  TravelerContactChannel,
  TravelerContactTemplate,
} from "../client/types.js";
import { formatContactResult } from "../formatters/traveler-formatter.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";
import { DESTRUCTIVE_WRITE_TOOL } from "../util/tool-annotations.js";
import { confirmationInputSchema, withConfirmation } from "../util/confirmation.js";

export const contactTravelersSchema = {
  traveler_ids: z
    .array(z.string().min(1))
    .min(1)
    .describe("List of traveler public IDs ('oc-<int>' or integer-as-string). Required, must be non-empty."),
  channel: z
    .enum(["email", "sms", "push"])
    .describe("Delivery channel for the message."),
  template: z
    .enum(["safety_check_in", "evacuation_advisory", "custom"])
    .describe("Message template. Use 'custom' with custom_message for a free-form note; otherwise the backend renders the named template."),
  custom_message: z
    .string()
    .min(1)
    .optional()
    .describe("Free-form message body. REQUIRED when template='custom'; ignored otherwise."),
};

export function contactTravelersHandler(client: TravelCodeApiClient) {
  return withImpersonation(async ({
    traveler_ids,
    channel,
    template,
    custom_message,
  }: {
    traveler_ids: string[];
    channel: TravelerContactChannel;
    template: TravelerContactTemplate;
    custom_message?: string;
  }) => {
    if (template === "custom" && !custom_message) {
      return {
        content: [
          {
            type: "text" as const,
            text: "custom_message is required when template='custom'.",
          },
        ],
        isError: true,
      };
    }

    const body: ContactTravelersRequest = {
      traveler_ids,
      channel,
      template,
      ...(template === "custom" ? { custom_message } : {}),
    };

    try {
      const data = await client.post<ContactTravelersResponse>("/travelers/contact", body);
      return {
        content: [{ type: "text" as const, text: formatContactResult(data) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error contacting travelers: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  });
}

export function registerContactTravelers(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "contact_travelers",
    [
      "Send a duty-of-care message to one or more travelers — safety check-in, evacuation advisory, or a custom note. Delivered via email, SMS, or push. Returns per-traveler queued/failed status.",
      "",
      "USER-FACING LANGUAGE: speak about 'reaching out', 'pinging', 'messaging the team'. Never quote internal labels, REST routes, or error codes.",
      "",
      "Before calling: agree with the user which travelers, which channel, and which template (for template='custom', the text). This triggers a real outbound message.",
      "CONFIRMATION: the server confirms with the user itself — either it asks them directly, or the first call returns NOT DONE YET with a summary and a token. Then show that summary, wait for the user's yes in their next message, and call again with the same arguments plus confirmation_token. Do not ask for a separate yes before the first call.",
      "",
      "Partial success is normal: the response may contain both 'sent' and 'failed' arrays — surface both to the user.",
    ].join("\n"),
    { ...contactTravelersSchema, ...impersonationInputSchema, ...confirmationInputSchema },
    DESTRUCTIVE_WRITE_TOOL,
    withConfirmation(
      server,
      "contact_travelers",
      (args) =>
        [
          `Send a ${String(args.template)} message by ${String(args.channel)} to ${Array.isArray(args.traveler_ids) ? args.traveler_ids.length : 0} traveller(s).`,
          args.template === "custom" && args.custom_message ? `Message: ${String(args.custom_message)}` : "",
          args.actAs ? `On behalf of: ${String(args.actAs)}` : "",
        ].filter(Boolean).join("\n"),
      contactTravelersHandler(client),
    ),
  );
}
