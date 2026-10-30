import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../src/server.js";
import { registerCreateOrder } from "../../src/tools/create-order.js";
import { TravelCodeNotFoundError, type TravelCodeApiClient } from "../../src/client/api-client.js";
import { shortFlightOfferRef } from "../../src/util/flight-offer-ref.js";

async function connect(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

const WRITE_TOOLS = new Set([
  "create_order", "cancel_order", "modify_order", "contact_travelers", "create_employee",
  "assign_travel_policy", "move_employee_to_department", "update_rate_guard_settings",
  "init_telegram_link", "activate_notification_integration", "disconnect_notification_integration",
  "update_notification_setting", "add_notification_email_bcc", "delete_notification_email_bcc",
  "send_notification_email_bcc_confirmation",
]);
const DESTRUCTIVE = ["cancel_order", "modify_order", "contact_travelers", "delete_notification_email_bcc", "disconnect_notification_integration"];

describe("tool annotations", () => {
  it("marks every tool as read-only or write, and change/remove tools as destructive", async () => {
    const { server } = createServer({ apiBaseUrl: "http://localhost", apiToken: "t", pollIntervalMs: 1, pollTimeoutMs: 1 });
    const client = await connect(server);
    const { tools } = await client.listTools();

    expect(tools.length).toBe(62);
    for (const tool of tools) {
      const expectedReadOnly = !WRITE_TOOLS.has(tool.name);
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(expectedReadOnly);
    }
    for (const name of DESTRUCTIVE) {
      expect(tools.find((t) => t.name === name)?.annotations?.destructiveHint, name).toBe(true);
    }
  });
});

const passenger = {
  firstName: "IVAN", lastName: "IVANOV", gender: "M", dateOfBirth: "1990-01-01", nationality: "BY",
  document: { number: "MP1234567", expiryDate: "2030-01-01" },
};

function setup(get: ReturnType<typeof vi.fn>) {
  const post = vi.fn().mockResolvedValue({ order: { id: 1, status: "new", services: [] } });
  const api = { get, post } as unknown as TravelCodeApiClient;
  const server = new McpServer({ name: "t", version: "0" });
  registerCreateOrder(server, api);
  return { post, server };
}

describe("create_order flight offer references", () => {
  const servedId = "abc".repeat(5000) + "_123.45";
  const ref = shortFlightOfferRef(servedId);

  it("maps a short reference back to the served id, scanning the second page", async () => {
    const page1 = Array.from({ length: 250 }, (_, i) => ({ id: `other_${i}`, items: [] }));
    const get = vi.fn()
      .mockResolvedValueOnce({ items: page1 })
      .mockResolvedValueOnce({ items: [{ id: servedId, items: [] }] });
    const { post, server } = setup(get);
    const client = await connect(server);

    const res = await client.callTool({
      name: "create_order",
      arguments: { service_type: "flight", session_id: "S1", offer_id: ref, passengers: [passenger] },
    });

    expect(res.isError).toBeFalsy();
    expect(get).toHaveBeenNthCalledWith(1, "/search/flights/S1", { limit: 250, offset: 0 });
    expect(get).toHaveBeenNthCalledWith(2, "/search/flights/S1", { limit: 250, offset: 250 });
    expect(post.mock.calls[0][1]).toMatchObject({ offerId: servedId, sessionId: "S1" });
  });

  it("refuses to book when the reference is no longer in the results", async () => {
    const get = vi.fn().mockResolvedValue({ items: [{ id: "something_else", items: [] }] });
    const { post, server } = setup(get);
    const client = await connect(server);

    const res = await client.callTool({
      name: "create_order",
      arguments: { service_type: "flight", session_id: "S1", offer_id: ref, passengers: [passenger] },
    });

    expect(res.isError).toBe(true);
    expect((res.content as Array<{ text: string }>)[0].text).toContain("no longer in the search results");
    expect(post).not.toHaveBeenCalled();
  });

  it("treats an expired search as the offer being gone", async () => {
    const get = vi.fn().mockRejectedValue(new TravelCodeNotFoundError("gone"));
    const { post, server } = setup(get);
    const client = await connect(server);

    const res = await client.callTool({
      name: "create_order",
      arguments: { service_type: "flight", session_id: "S1", offer_id: ref, passengers: [passenger] },
    });

    expect(res.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it("passes a raw served id through unchanged", async () => {
    const get = vi.fn();
    const { post, server } = setup(get);
    const client = await connect(server);

    await client.callTool({
      name: "create_order",
      arguments: { service_type: "flight", session_id: "S1", offer_id: servedId, passengers: [passenger] },
    });

    expect(get).not.toHaveBeenCalled();
    expect(post.mock.calls[0][1]).toMatchObject({ offerId: servedId });
  });
});

describe("create_order hotel guests", () => {
  it("defaults the guest type to adult and keeps an explicit one", async () => {
    const { post, server } = setup(vi.fn());
    const client = await connect(server);

    await client.callTool({
      name: "create_order",
      arguments: {
        service_type: "hotel",
        session_id: "H1",
        offer_id: "rate-1",
        rooms: [{
          guests: [
            { firstName: "A", lastName: "B", dateOfBirth: "1990-01-01", nationality: "BY", isMain: true },
            { type: "child", firstName: "C", lastName: "B", dateOfBirth: "2018-01-01", nationality: "BY" },
          ],
        }],
      },
    });

    const guests = post.mock.calls[0][1].rooms[0].guests;
    expect(guests[0].type).toBe("adult");
    expect(guests[1].type).toBe("child");
  });
});
