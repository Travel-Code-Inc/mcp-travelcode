import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { OrderEnvelope, OrderFull } from "../client/types.js";
import { formatOrderDetail } from "../formatters/order-formatter.js";

export const getOrderSchema = {
  order_id: z.number().int().describe("Order ID"),
};

export function registerGetOrder(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_order",
    "Get full details of a booking — travelers, services, tickets, and payment status. Speak about 'the booking' to the user; never quote internal labels, REST routes, or error codes.",
    getOrderSchema,
    async ({ order_id }) => {
      try {
        const raw = await client.get<OrderEnvelope | OrderFull>(`/orders/${order_id}`);
        const order: OrderFull = (raw as OrderEnvelope).order ?? (raw as OrderFull);

        return {
          content: [{ type: "text", text: formatOrderDetail(order) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting order ${order_id}: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
