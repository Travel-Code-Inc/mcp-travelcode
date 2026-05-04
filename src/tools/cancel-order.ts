import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { CancelResult } from "../client/types.js";
import { formatCancelResult } from "../formatters/order-formatter.js";

export const cancelOrderSchema = {
  order_id: z.number().int().describe("Order ID to cancel"),
  reason: z.string().optional().describe("Reason for cancellation"),
};

export function registerCancelOrder(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "cancel_order",
    [
      "Cancel an order.",
      "",
      "Required flow:",
      "  1. Call check_order_cancellation first to learn the penalty / refund / deadline.",
      "  2. Show the result to the user and get explicit confirmation — penalties can be 100%.",
      "  3. Only then call this tool.",
      "",
      "Cancellation is asynchronous — use get_order to poll the final status. Idempotent: calling on an already-cancelled order returns the current status. Returns ORDER_NOT_CANCELLABLE if the cancel window has passed or the order is in a terminal state.",
    ].join("\n"),
    cancelOrderSchema,
    async ({ order_id, reason }) => {
      try {
        const body = reason ? { reason } : undefined;
        const data = await client.post<CancelResult>(`/orders/${order_id}/cancel`, body);

        return {
          content: [{ type: "text", text: formatCancelResult(data) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error cancelling order ${order_id}: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
