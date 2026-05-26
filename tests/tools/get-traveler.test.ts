import { describe, it, expect, vi } from "vitest";
import { getTravelerHandler } from "../../src/tools/get-traveler.js";
import type { TravelCodeApiClient } from "../../src/client/api-client.js";
import type { TravelerDetailResponse } from "../../src/client/types.js";

const sampleResponse: TravelerDetailResponse = {
  data: {
    id: "oc-12345",
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "+1987654321",
    city: "London",
    country_iso: "GBR",
    trip_start: "2026-05-28T14:30:00Z",
    trip_end: "2026-06-05T09:00:00Z",
    status: "enroute",
    passport_number: "AB123456",
    passport_expire_at: "2030-12-31",
    birth_day: "1990-06-15",
    nationality: "USA",
    current_trip: {
      order_id: 5678,
      order_status: "FINISH",
      services: [
        {
          type: "hotel",
          title: "The Savoy",
          date: "2026-05-28",
          duration_days: 5,
          country_iso: "GBR",
          city: "London",
        },
        {
          type: "flight",
          title: "Return to JFK",
          date: "2026-06-05",
          duration_days: null,
          country_iso: "USA",
          city: "New York",
        },
      ],
    },
  },
  fetched_at: "2026-05-26T14:30:45Z",
};

describe("get_traveler handler", () => {
  it("requests /travelers/{id} and renders passport + services", async () => {
    const get = vi.fn().mockResolvedValue(sampleResponse);
    const client = { get } as unknown as TravelCodeApiClient;
    const handler = getTravelerHandler(client);

    const result = await handler({ id: "oc-12345" }, {} as never);

    expect(get).toHaveBeenCalledWith("/travelers/oc-12345");

    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Traveler #oc-12345");
    expect(text).toContain("Jane Doe");
    expect(text).toContain("passport AB123456");
    expect(text).toContain("expires 2030-12-31");
    expect(text).toContain("Current trip:");
    expect(text).toContain("hotel · The Savoy");
    expect(text).toContain("flight · Return to JFK");
    expect(result.isError).toBeUndefined();
  });

  it("URL-encodes the id when it contains special characters", async () => {
    const get = vi.fn().mockResolvedValue(sampleResponse);
    const client = { get } as unknown as TravelCodeApiClient;
    const handler = getTravelerHandler(client);

    await handler({ id: "oc 99 weird" }, {} as never);

    expect(get).toHaveBeenCalledWith("/travelers/oc%2099%20weird");
  });

  it("returns isError when the API throws not-found", async () => {
    const client = {
      get: vi.fn().mockRejectedValue(new Error("ENTITY_NOT_FOUND")),
    } as unknown as TravelCodeApiClient;
    const handler = getTravelerHandler(client);

    const result = await handler({ id: "oc-999" }, {} as never);
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("ENTITY_NOT_FOUND");
  });
});
