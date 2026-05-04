import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { CancelCheckResponse } from "../client/types.js";
import { formatCancelCheck } from "../formatters/order-formatter.js";

export const checkOrderCancellationSchema = {
  order_id: z.number().int().describe("Order ID to check cancellation for"),
};

export function registerCheckOrderCancellation(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "check_order_cancellation",
    "Check if a booking can be cancelled and what the refund/penalty/deadline are. Always call this before cancel_order. Speak about 'the booking' and 'cancellation rules' to the user — never quote internal labels, REST routes, or error codes.",
    checkOrderCancellationSchema,
    async ({ order_id }) => {
      try {
        const data = await client.get<CancelCheckResponse>(`/orders/${order_id}/cancel/check`);

        return {
          content: [{ type: "text", text: formatCancelCheck(data, order_id) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error checking cancellation for order ${order_id}: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
