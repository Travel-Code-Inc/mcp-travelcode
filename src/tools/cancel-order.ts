import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { CancelResult } from "../client/types.js";
import { formatCancelResult } from "../formatters/order-formatter.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";

export const cancelOrderSchema = {
  order_id: z.number().int().describe("Order ID to cancel"),
  reason: z.string().optional().describe("Reason for cancellation"),
};

export function registerCancelOrder(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "cancel_order",
    [
      "Cancel a booking.",
      "",
      "USER-FACING LANGUAGE: speak in plain language ('cancel the booking', 'the penalty is …', 'the cancel window has passed'). Never quote internal labels, REST routes, or error codes.",
      "",
      "Required flow:",
      "  1. First call check_order_cancellation to learn the penalty, refund and deadline.",
      "  2. Tell the user the numbers in plain words and ask for explicit confirmation — penalties can be 100%.",
      "  3. Only after explicit yes, call this tool.",
      "",
      "Cancellation is asynchronous — use get_order afterwards to confirm the final status. Calling on an already-cancelled booking returns the current status (no error). If the cancel window has passed or the booking is already terminal, the tool will report it — phrase it for the user as 'this booking can no longer be cancelled'.",
    ].join("\n"),
    { ...cancelOrderSchema, ...impersonationInputSchema },
    withImpersonation(async ({ order_id, reason }) => {
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
    })
  );
}
