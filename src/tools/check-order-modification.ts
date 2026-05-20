import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { ModifyCheckResponse } from "../client/types.js";
import { formatModifyCheck } from "../formatters/order-formatter.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";

export const checkOrderModificationSchema = {
  order_id: z.number().int().describe("Order ID to check modification for"),
};

export function registerCheckOrderModification(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "check_order_modification",
    "Check if a booking can be changed and what kinds of change are allowed (contact info, passport, rebook, baggage). Always call this before modify_order. Speak about 'the booking' and 'allowed changes' to the user — never quote internal labels, REST routes, or error codes.",
    { ...checkOrderModificationSchema, ...impersonationInputSchema },
    withImpersonation(async ({ order_id }) => {
      try {
        const data = await client.get<ModifyCheckResponse>(`/orders/${order_id}/modify/check`);

        return {
          content: [{ type: "text", text: formatModifyCheck(data, order_id) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error checking modification for order ${order_id}: ${(error as Error).message}` }],
          isError: true,
        };
      }
    })
  );
}
