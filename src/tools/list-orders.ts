import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { OrderList } from "../client/types.js";
import { formatOrderList } from "../formatters/order-formatter.js";

export const listOrdersSchema = {
  status: z
    .enum(["pre_order", "pre_payment", "pre_book", "finish", "canceled"])
    .optional()
    .describe(
      "Filter by order status (Travel Code REST §9.2): pre_order (draft), pre_payment (awaiting payment), pre_book (booking in progress), finish (confirmed/finalized), canceled.",
    ),
  pnr: z.string().optional().describe("Search by PNR (booking reference)"),
  passenger_name: z.string().optional().describe("Search by passenger first or last name"),
  date_from: z.string().optional().describe("Filter orders created from this date (YYYY-MM-DD)"),
  date_to: z.string().optional().describe("Filter orders created until this date (YYYY-MM-DD)"),
  sort: z
    .enum(["createdAt", "updatedAt", "price", "status"])
    .default("createdAt")
    .describe("Sort field"),
  sort_order: z.enum(["asc", "desc"]).default("desc").describe("Sort direction"),
  offset: z.number().int().min(0).default(0).describe("Pagination offset"),
  limit: z.number().int().min(1).max(100).default(20).describe("Number of results to return"),
};

export function registerListOrders(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "list_orders",
    "List the user's bookings with optional filtering by status, booking reference, traveler name, or date range. Supports paging and sorting. Speak in plain language to the user — never quote internal labels, REST routes, or error codes.",
    listOrdersSchema,
    async ({ status, pnr, passenger_name, date_from, date_to, sort, sort_order, offset, limit }) => {
      try {
        const data = await client.get<OrderList>("/orders", {
          status,
          pnr,
          passengerName: passenger_name,
          dateFrom: date_from,
          dateTo: date_to,
          sort,
          sortOrder: sort_order,
          offset,
          limit,
        });

        return {
          content: [{ type: "text", text: formatOrderList(data) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error listing orders: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
