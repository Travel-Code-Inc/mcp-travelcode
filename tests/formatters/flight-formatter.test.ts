import { describe, it, expect } from "vitest";
import { formatFilteredResults } from "../../src/formatters/flight-formatter.js";
import { shortFlightOfferRef } from "../../src/util/flight-offer-ref.js";
import type { FlightSearchResultsResponse } from "../../src/client/types.js";

function seg(from: string, to: string, dep: string, arr: string, carrier: string, number: string) {
  return {
    departure: { iata_code: from, at: dep, terminal: "", airport: { iata_code: from, title: from } },
    arrival: { iata_code: to, at: arr, terminal: "", airport: { iata_code: to, title: to } },
    carrier_code: carrier, number, duration: "2:0", cabin: "economy",
  };
}

function leg(segments: ReturnType<typeof seg>[]) {
  return {
    service: "amadeus", type: "ow", availableSeats: 4, cabinClass: "economy", airline: segments[0].carrier_code,
    includeBaggage: true, include_baggage: { count: 1, unit: "PC" },
    price: { currency: "EUR", totalPrice: 100, inclusivePrice: 0, exclusivePrice: 0 },
    itineraries: [{ duration: "4:0", transfers: segments.length - 1, segments }], id: 1,
  };
}

const servedId = "x".repeat(40000);

const response = {
  status: "completed", cacheId: "C1", total: 1, limit: 10, offset: 0, currency: "EUR", currencySign: "€",
  airlines: { LH: "Lufthansa" },
  items: [{
    id: servedId, totalPrice: 250, totalPriceNet: 240, durationTime: "8:0",
    // Keyed object, as PHP sometimes serializes per-leg items.
    items: {
      0: leg([seg("MSQ", "FRA", "2026-11-10T08:00:00", "2026-11-10T10:00:00", "LH", "1489")]),
      1: leg([
        seg("FRA", "WAW", "2026-11-17T09:00:00", "2026-11-17T11:00:00", "LH", "LH1350"),
        seg("WAW", "MSQ", "2026-11-17T12:00:00", "2026-11-17T14:00:00", "LH", "6200"),
      ]),
    },
  }],
} as unknown as FlightSearchResultsResponse;

describe("flight formatter", () => {
  const text = formatFilteredResults(response, "C1", "");

  it("shows every leg with its flight numbers and stops", () => {
    expect(text).toContain("Outbound: MSQ 2026-11-10 08:00 → FRA 10:00 (4:0) | Direct");
    expect(text).toContain("Return: FRA 2026-11-17 09:00 → MSQ 14:00 (4:0) | 1 stop");
    expect(text).toContain("Flights: LH1489");
    expect(text).toContain("Flights: LH1350, LH6200");
    expect(text).toContain("Via: WAW");
  });

  it("uses the response currency and a short offer reference instead of the served id", () => {
    expect(text).toContain("Lufthansa (LH) | €250");
    expect(text).toContain(`offer_reference=${shortFlightOfferRef(servedId)}`);
    expect(text).not.toContain(servedId);
    expect(text).not.toContain("$");
  });
});
