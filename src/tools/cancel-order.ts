import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { CancelResult } from "../client/types.js";
import { formatCancelResult } from "../formatters/order-formatter.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";
import { DESTRUCTIVE_WRITE_TOOL } from "../util/tool-annotations.js";
import { confirmationInputSchema, withConfirmation } from "../util/confirmation.js";

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
      "  2. Tell the user the numbers in plain words — penalties can be 100%.",
      "  3. Call this tool; the server takes the user's confirmation (see below).",
      "",
      "CONFIRMATION: the server confirms with the user itself — either it asks them directly, or the first call returns NOT DONE YET with a summary and a token. Then show that summary, wait for the user's yes in their next message, and call again with the same arguments plus confirmation_token. Do not ask for a separate yes before the first call.",
      "",
      "Cancellation is asynchronous — use get_order afterwards to confirm the final status. Calling on an already-cancelled booking returns the current status (no error). If the cancel window has passed or the booking is already terminal, the tool will report it — phrase it for the user as 'this booking can no longer be cancelled'.",
    ].join("\n"),
    { ...cancelOrderSchema, ...impersonationInputSchema, ...confirmationInputSchema },
    DESTRUCTIVE_WRITE_TOOL,
    withConfirmation(server, "cancel_order", (args) => cancelSummary(client, args), withImpersonation(async ({ order_id, reason }) => {
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
    }))
  );
}

async function cancelSummary(client: TravelCodeApiClient, args: Record<string, unknown>): Promise<string> {
  const lines = [`Cancel booking ${String(args.order_id)}.`];
  try {
    const check = await client.get<Record<string, any>>(`/orders/${String(args.order_id)}/cancel/check`);
    const refund = check?.refund as Record<string, unknown> | undefined;
    if (check?.cancellable === false) lines.push("The platform says it can no longer be cancelled.");
    if (refund) lines.push(`Penalty: ${String(refund.penalty ?? 0)} ${String(refund.currency ?? "")}; refund: ${String(refund.estimatedAmount ?? 0)} ${String(refund.currency ?? "")}.`.replace(/\s+;/g, ";"));
  } catch {
    lines.push("The penalty could not be checked — tell the user it may apply.");
  }
  if (args.reason) lines.push(`Reason: ${String(args.reason)}`);
  if (args.actAs) lines.push(`On behalf of: ${String(args.actAs)}`);
  return lines.join("\n");
}
