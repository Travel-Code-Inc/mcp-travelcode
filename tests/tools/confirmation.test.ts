import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { registerCancelOrder } from "../../src/tools/cancel-order.js";
import type { TravelCodeApiClient } from "../../src/client/api-client.js";
import { resetConfirmations } from "../../src/util/confirmation.js";

function setup() {
  const get = vi.fn().mockResolvedValue({ cancellable: true, refund: { penalty: 0, estimatedAmount: 288.4, currency: "USD" } });
  const post = vi.fn().mockResolvedValue({ orderId: "1", status: "pending_cancellation" });
  const server = new McpServer({ name: "t", version: "0" });
  registerCancelOrder(server, { get, post } as unknown as TravelCodeApiClient);
  return { server, post };
}

async function connect(server: McpServer, elicit?: "accept" | "decline"): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "0.0.0" }, elicit ? { capabilities: { elicitation: {} } } : {});
  if (elicit) {
    client.setRequestHandler(ElicitRequestSchema, async () =>
      elicit === "accept" ? { action: "accept", content: { confirm: true } } : { action: "decline" },
    );
  }
  await client.connect(clientTransport);
  return client;
}

const text = (res: { content: unknown }) => (res.content as Array<{ text: string }>)[0].text;
const tokenOf = (res: { content: unknown }) => /confirmation_token="([0-9a-f]+)"/.exec(text(res))?.[1];

describe("server-side confirmation", () => {
  beforeEach(() => resetConfirmations());

  it("without elicitation: the first call does nothing and returns a summary with a token", async () => {
    const { server, post } = setup();
    const client = await connect(server);
    const first = await client.callTool({ name: "cancel_order", arguments: { order_id: 64466 } });
    expect(post).not.toHaveBeenCalled();
    expect(text(first)).toMatch(/NOT DONE YET/);
    expect(text(first)).toMatch(/Penalty: 0 USD/);

    const second = await client.callTool({ name: "cancel_order", arguments: { order_id: 64466, confirmation_token: tokenOf(first) } });
    expect(second.isError).toBeFalsy();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("a token is single-use and bound to the exact arguments", async () => {
    const { server, post } = setup();
    const client = await connect(server);
    const first = await client.callTool({ name: "cancel_order", arguments: { order_id: 64466 } });
    const token = tokenOf(first);

    const other = await client.callTool({ name: "cancel_order", arguments: { order_id: 99999, confirmation_token: token } });
    expect(other.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();

    const fresh = await client.callTool({ name: "cancel_order", arguments: { order_id: 64466 } });
    await client.callTool({ name: "cancel_order", arguments: { order_id: 64466, confirmation_token: tokenOf(fresh) } });
    const replay = await client.callTool({ name: "cancel_order", arguments: { order_id: 64466, confirmation_token: tokenOf(fresh) } });
    expect(replay.isError).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("with elicitation the person decides: decline does nothing, accept runs it", async () => {
    const declined = setup();
    const c1 = await connect(declined.server, "decline");
    const res1 = await c1.callTool({ name: "cancel_order", arguments: { order_id: 1 } });
    expect(text(res1)).toMatch(/did not confirm/);
    expect(declined.post).not.toHaveBeenCalled();

    const accepted = setup();
    const c2 = await connect(accepted.server, "accept");
    await c2.callTool({ name: "cancel_order", arguments: { order_id: 1 } });
    expect(accepted.post).toHaveBeenCalledTimes(1);
  });
});
