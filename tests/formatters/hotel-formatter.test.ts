import { describe, it, expect } from "vitest";
import { formatHotelOffers, formatHotelResults, rateRefundability } from "../../src/formatters/hotel-formatter.js";
import type { HotelOfferRate, HotelOffersResponse } from "../../src/client/types.js";

const now = new Date("2026-10-29T12:00:00Z");

describe("rateRefundability", () => {
  it("is non-refundable when the title says there is no refund, despite the flag", () => {
    expect(rateRefundability({ refundable: true, fullyRefundable: false, title: "Возврат не предусмотрен" }, now).refundable).toBe(false);
    expect(rateRefundability({ refundable: true, fullyRefundable: false, title: "Non-refundable rate" }, now).refundable).toBe(false);
  });

  it("is non-refundable once the first penalty has started", () => {
    const policy = {
      refundable: true, fullyRefundable: false, title: "Free cancellation",
      rules: [
        { deadline: "2026-11-05 00:00:00", type: "amount", value: 200 },
        { deadline: "2026-10-28 18:00:00", type: "amount", value: 50 },
      ],
    };
    expect(rateRefundability(policy, now)).toEqual({ refundable: false });
  });

  it("reports the earliest penalised deadline as the free-cancellation limit", () => {
    const policy = {
      refundable: true, fullyRefundable: false, title: "Free cancellation",
      rules: [
        { deadline: "2026-10-20 00:00:00", type: "amount", value: 0 },
        { deadline: "2026-11-05 00:00:00", type: "amount", value: 200 },
        { deadline: "2026-11-03 14:00:00", type: "amount", value: 80 },
      ],
    };
    expect(rateRefundability(policy, now)).toEqual({ refundable: true, freeCancellationUntil: "2026-11-03 14:00:00" });
  });

  it("is non-refundable when the supplier flag is false", () => {
    expect(rateRefundability({ refundable: false, fullyRefundable: false, title: "" }, now).refundable).toBe(false);
  });
});

function rate(id: string, nightly: number): HotelOfferRate {
  return {
    id, _offerId: `legacy-${id}`, boardName: "Room only",
    price: { currency: "EUR", net: 0, gross: 0, total: nightly * 2, markup: 0, nights: 2, rooms: 1, nightly },
    cancelPolicy: { refundable: true, fullyRefundable: true, title: "Возврат не предусмотрен" },
  };
}

describe("formatHotelOffers", () => {
  const offers: Record<string, { rates: HotelOfferRate[] }> = {};
  for (let i = 0; i < 15; i++) offers[`Room ${i}`] = { rates: [rate(`r${i}`, 100 + i)] };
  const data = { property: { name: "Hotel" }, offers, sessionId: "S" } as unknown as HotelOffersResponse;
  const text = formatHotelOffers(data);

  it("puts the rate id first in the reference", () => {
    expect(text).toContain("offer_reference=r0");
    expect(text).not.toContain("offer_reference=legacy-r0");
  });

  it("caps the room groups shown", () => {
    expect(text).toContain("--- Room 11 ");
    expect(text).not.toContain("--- Room 12 ");
    expect(text).toContain("... and 3 more room types not shown.");
  });

  it("does not call a no-refund titled rate refundable", () => {
    expect(text).not.toContain("Refundable options available");
    expect(text).toContain("Non-refundable");
  });
});

describe("formatHotelResults", () => {
  it("uses the response currency and never prints the supplier", () => {
    const text = formatHotelResults(
      [{ propertyName: "Hotel", price: 90, total: 180, currency: "EUR", partnerName: "SupplierX", refundable: true }],
      1,
    );
    expect(text).toContain("Price: 90 EUR/night (total: 180 EUR)");
    expect(text).not.toContain("SupplierX");
    expect(text).not.toContain("$");
  });
});
