import { describe, it, expect, vi } from "vitest";
import { contactTravelersHandler } from "../../src/tools/contact-travelers.js";
import type { TravelCodeApiClient } from "../../src/client/api-client.js";
import type { ContactTravelersResponse } from "../../src/client/types.js";

const partialResponse: ContactTravelersResponse = {
  sent: [{ id: "oc-100", channel: "email", status: "queued" }],
  failed: [{ id: "oc-200", reason: "not_accessible" }],
  fetched_at: "2026-05-26T14:30:45Z",
};

describe("contact_travelers handler", () => {
  it("posts to /travelers/contact with the channel/template and renders both sent and failed", async () => {
    const post = vi.fn().mockResolvedValue(partialResponse);
    const client = { post } as unknown as TravelCodeApiClient;
    const handler = contactTravelersHandler(client);

    const result = await handler(
      {
        traveler_ids: ["oc-100", "oc-200"],
        channel: "email",
        template: "safety_check_in",
      },
      {} as never,
    );

    expect(post).toHaveBeenCalledWith("/travelers/contact", {
      traveler_ids: ["oc-100", "oc-200"],
      channel: "email",
      template: "safety_check_in",
    });

    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Queued: 1 · Failed: 1");
    expect(text).toContain("#oc-100 via email → queued");
    expect(text).toContain("#oc-200 → not_accessible");
    expect(result.isError).toBeUndefined();
  });

  it("includes custom_message in the body only when template='custom'", async () => {
    const post = vi.fn().mockResolvedValue({ sent: [], failed: [] });
    const client = { post } as unknown as TravelCodeApiClient;
    const handler = contactTravelersHandler(client);

    await handler(
      {
        traveler_ids: ["oc-1"],
        channel: "sms",
        template: "custom",
        custom_message: "Please check in.",
      },
      {} as never,
    );

    expect(post).toHaveBeenCalledWith("/travelers/contact", {
      traveler_ids: ["oc-1"],
      channel: "sms",
      template: "custom",
      custom_message: "Please check in.",
    });
  });

  it("refuses to call the API when template='custom' is missing custom_message", async () => {
    const post = vi.fn();
    const client = { post } as unknown as TravelCodeApiClient;
    const handler = contactTravelersHandler(client);

    const result = await handler(
      {
        traveler_ids: ["oc-1"],
        channel: "email",
        template: "custom",
      },
      {} as never,
    );

    expect(post).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toMatch(/custom_message is required/);
  });

  it("returns isError when the API rejects", async () => {
    const client = {
      post: vi.fn().mockRejectedValue(new Error("network")),
    } as unknown as TravelCodeApiClient;
    const handler = contactTravelersHandler(client);

    const result = await handler(
      {
        traveler_ids: ["oc-1"],
        channel: "push",
        template: "evacuation_advisory",
      },
      {} as never,
    );

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("network");
  });
});
