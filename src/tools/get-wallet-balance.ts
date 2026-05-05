import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { WalletBalance, WalletBalanceEntry } from "../client/types.js";

export const getWalletBalanceSchema = {};

/**
 * Normalize the wallet response into a list of {currency, amount} entries.
 * Tolerates the documented `{balances:[{currency,amount}]}` shape as well as
 * a flat `{amount,currency}` single-currency response.
 */
export function normalizeWalletBalances(data: WalletBalance): WalletBalanceEntry[] {
  if (Array.isArray(data.balances)) {
    return data.balances
      .filter((b): b is WalletBalanceEntry => !!b && typeof b.currency === "string" && typeof b.amount === "number")
      .map((b) => ({ currency: b.currency.toUpperCase(), amount: b.amount }));
  }
  if (typeof data.amount === "number" && typeof data.currency === "string") {
    return [{ currency: data.currency.toUpperCase(), amount: data.amount }];
  }
  return [];
}

export function findBalanceForCurrency(
  data: WalletBalance,
  currency: string,
): number | undefined {
  const target = currency.toUpperCase();
  const entry = normalizeWalletBalances(data).find((b) => b.currency === target);
  return entry?.amount;
}

export function formatWalletBalance(data: WalletBalance): string {
  const entries = normalizeWalletBalances(data);
  if (entries.length === 0) {
    return "Wallet balance: empty (no funded currencies).";
  }
  const lines = ["Wallet balance:"];
  for (const e of entries) {
    lines.push(`  ${e.amount} ${e.currency}`);
  }
  return lines.join("\n");
}

export function registerGetWalletBalance(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_wallet_balance",
    [
      "Return the current deposit balance of the authenticated account, broken down per currency.",
      "",
      "USE THIS BEFORE create_order when the user is authenticated, so we can pick the cheapest payment route automatically:",
      "  • Compare the deposit balance in the offer's currency to the offer total (which you already have from the prior search/offers tool).",
      "  • If the deposit covers the price, call create_order with payment_method='deposit'.",
      "  • If it does not, call create_order with payment_method='card' (the account default for non-corp users).",
      "  • If the deposit balance is borderline (covers the price but would leave very little buffer), tell the user the remaining balance after the booking and ask whether to use deposit or card.",
      "",
      "USER-FACING LANGUAGE: speak about 'your deposit balance', 'enough on deposit to cover this', 'we'll charge your card'. Never quote internal labels, REST routes, or parameter names like 'paymentMethod', 'wallet', 'GET /v1/wallet'.",
      "",
      "Skip this tool entirely for unauthenticated price-discovery flows — there is no wallet without a logged-in user.",
    ].join("\n"),
    getWalletBalanceSchema,
    async () => {
      try {
        const data = await client.get<WalletBalance>("/wallet");
        return { content: [{ type: "text", text: formatWalletBalance(data) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching wallet balance: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
