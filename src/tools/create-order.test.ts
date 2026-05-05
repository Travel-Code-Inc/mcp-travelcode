import { describe, it, expect, beforeEach } from "vitest";
import { registerCreateOrder } from "./create-order.js";

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

interface CapturedPost {
  path: string;
  body: Record<string, unknown> | undefined;
  extraHeaders: Record<string, string> | undefined;
}

function makeMocks() {
  const captured: CapturedPost[] = [];
  const client = {
    post: async <T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> => {
      captured.push({
        path,
        body: body as Record<string, unknown> | undefined,
        extraHeaders,
      });
      return { order: { id: 999, status: "pre_payment" } } as unknown as T;
    },
  };

  let handler: Handler | undefined;
  const server = {
    tool: (
      name: string,
      _description: string,
      _schema: unknown,
      cb: Handler,
    ) => {
      if (name === "create_order") handler = cb;
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerCreateOrder(server as any, client as any);
  if (!handler) throw new Error("create_order was not registered");

  return { handler, captured };
}

const baseFlightArgs = {
  service_type: "flight",
  session_id: "cache-123",
  offer_id: "offer-1",
  passengers: [
    {
      firstName: "Alex",
      lastName: "Doe",
      gender: "M",
      dateOfBirth: "1990-05-12",
      nationality: "GB",
      document: {
        type: "passport",
        number: "X12345",
        expiryDate: "2030-01-01",
        nationality: "GB",
      },
    },
  ],
};

describe("create_order paymentMethod selection", () => {
  let mocks: ReturnType<typeof makeMocks>;

  beforeEach(() => {
    mocks = makeMocks();
  });

  it("forwards 'deposit' when chosen", async () => {
    await mocks.handler({ ...baseFlightArgs, payment_method: "deposit" });
    expect(mocks.captured).toHaveLength(1);
    expect(mocks.captured[0].path).toBe("/orders");
    expect(mocks.captured[0].body?.paymentMethod).toBe("deposit");
  });

  it("forwards 'card' when chosen", async () => {
    await mocks.handler({ ...baseFlightArgs, payment_method: "card" });
    expect(mocks.captured[0].body?.paymentMethod).toBe("card");
  });

  it("forwards 'bill' when explicitly requested", async () => {
    await mocks.handler({ ...baseFlightArgs, payment_method: "bill" });
    expect(mocks.captured[0].body?.paymentMethod).toBe("bill");
  });

  it("omits paymentMethod when not provided so the server picks the account default", async () => {
    await mocks.handler({ ...baseFlightArgs });
    const body = mocks.captured[0].body ?? {};
    expect(body).not.toHaveProperty("paymentMethod");
  });

  it("threads Idempotency-Key into request headers when provided", async () => {
    await mocks.handler({
      ...baseFlightArgs,
      payment_method: "deposit",
      idempotency_key: "uuid-abc",
    });
    expect(mocks.captured[0].extraHeaders).toEqual({ "Idempotency-Key": "uuid-abc" });
  });
});

describe("create_order normalizes traveler dates regardless of payment route", () => {
  it("normalizes DD.MM.YYYY date of birth and document expiry to YYYY-MM-DD", async () => {
    const { handler, captured } = makeMocks();
    await handler({
      service_type: "flight",
      session_id: "cache-123",
      offer_id: "offer-1",
      payment_method: "deposit",
      passengers: [
        {
          firstName: "Alex",
          lastName: "Doe",
          gender: "M",
          dateOfBirth: "25.05.1990",
          nationality: "GB",
          document: {
            type: "passport",
            number: "X12345",
            expiryDate: "15.01.2030",
            nationality: "GB",
          },
        },
      ],
    });

    const passengers = captured[0].body?.passengers as Array<Record<string, unknown>>;
    const p = passengers[0];
    expect(p.dateOfBirth).toBe("1990-05-25");
    expect(p.birthDate).toBe("1990-05-25");
    const doc = p.document as Record<string, unknown>;
    expect(doc.expiryDate).toBe("2030-01-15");
    expect(doc.expiry).toBe("2030-01-15");
  });
});
