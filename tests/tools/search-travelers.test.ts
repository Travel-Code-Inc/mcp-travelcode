import { describe, it, expect, vi } from "vitest";
import { searchTravelersHandler } from "../../src/tools/search-travelers.js";
import type { TravelCodeApiClient } from "../../src/client/api-client.js";
import type { TravelersListResponse } from "../../src/client/types.js";

function makeClient(response: TravelersListResponse) {
  const get = vi.fn().mockResolvedValue(response);
  return {
    client: { get } as unknown as TravelCodeApiClient,
    get,
  };
}

const sampleResponse: TravelersListResponse = {
  data: [
    {
      id: "oc-12345",
      name: "John Doe",
      email: "john@example.com",
      phone: "+1234567890",
      city: "London",
      country_iso: "GBR",
      trip_start: "2026-05-28T14:30:00Z",
      trip_end: "2026-06-05T09:00:00Z",
      status: "enroute",
    },
  ],
  pagination: { offset: 0, limit: 100, total: 1 },
  fetched_at: "2026-05-26T14:30:45Z",
};

describe("search_travelers handler", () => {
  it("calls /travelers with all forwarded query params and renders the list", async () => {
    const { client, get } = makeClient(sampleResponse);
    const handler = searchTravelersHandler(client);

    const result = await handler(
      {
        active: true,
        trip_from: "2026-05-01",
        trip_to: "2026-06-30",
        country_iso: "GBR",
        q: "Doe",
        order_status: "finish,pre_book",
        offset: 0,
        limit: 50,
        sort: "trip_start",
        sort_order: "asc",
      },
      {} as never,
    );

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("/travelers", {
      active: true,
      trip_from: "2026-05-01",
      trip_to: "2026-06-30",
      country_iso: "GBR",
      q: "Doe",
      order_status: "finish,pre_book",
      offset: 0,
      limit: 50,
      sort: "trip_start",
      sort_order: "asc",
    });

    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("1 of 1 travelers");
    expect(text).toContain("John Doe");
    expect(text).toContain("GBR");
    expect(text).toContain("2026-05-28 → 2026-06-05");
    expect(result.isError).toBeUndefined();
  });

  it("returns an empty-state message when no travelers match", async () => {
    const { client } = makeClient({
      data: [],
      pagination: { offset: 0, limit: 100, total: 0 },
    });
    const handler = searchTravelersHandler(client);

    const result = await handler(
      {
        offset: 0,
        limit: 100,
        sort: "trip_start",
        sort_order: "asc",
      },
      {} as never,
    );

    const text = (result.content[0] as { text: string }).text;
    expect(text).toMatch(/no travelers found/i);
  });

  it("returns isError when the API throws", async () => {
    const client = {
      get: vi.fn().mockRejectedValue(new Error("upstream down")),
    } as unknown as TravelCodeApiClient;
    const handler = searchTravelersHandler(client);

    const result = await handler(
      {
        offset: 0,
        limit: 100,
        sort: "trip_start",
        sort_order: "asc",
      },
      {} as never,
    );

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("upstream down");
  });
});
