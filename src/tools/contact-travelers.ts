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
      "Before calling: confirm with the user which travelers, which channel, and which template. For template='custom', show the drafted message back and get approval first — this triggers a real outbound message.",
      "",
      "Partial success is normal: the response may contain both 'sent' and 'failed' arrays — surface both to the user.",
    ].join("\n"),
    { ...contactTravelersSchema, ...impersonationInputSchema },
    contactTravelersHandler(client),
  );
}
