import {
  FlightItinerary,
  FlightOffer,
  FlightOfferItem,
  FlightSearchResultsResponse,
  FlightSegment,
} from "../client/types.js";
import { shortFlightOfferRef } from "../util/flight-offer-ref.js";

interface SearchMeta {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  cabinClass: string;
  passengers: string;
}

function flightNumber(segment: FlightSegment): string {
  const carrier = segment.carrier_code || "";
  const number = segment.number ? String(segment.number) : "";
  if (number) return number.startsWith(carrier) ? number : `${carrier}${number}`;
  return segment.flight_number || carrier;
}

function hhmm(at: string | undefined): string {
  return at?.split("T")[1]?.substring(0, 5) || "";
}

function formatItinerary(itinerary: FlightItinerary, label: string): string[] {
  const lines: string[] = [];
  const segments = itinerary.segments ?? [];

  if (segments.length === 0) return lines;

  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];

  const depCode = firstSeg.departure.iata_code;
  const arrCode = lastSeg.arrival.iata_code;
  const depDate = firstSeg.departure.at?.split("T")[0] || "";

  const stops = typeof itinerary.transfers === "number" ? itinerary.transfers : segments.length - 1;
  const stopsText = stops === 0 ? "Direct" : stops === 1 ? "1 stop" : `${stops} stops`;

  const flightNums = segments.map(flightNumber).join(", ");
  const duration = itinerary.duration ? ` (${itinerary.duration})` : "";

  lines.push(`   ${label}: ${depCode} ${depDate} ${hhmm(firstSeg.departure.at)} → ${arrCode} ${hhmm(lastSeg.arrival.at)}${duration} | ${stopsText}`);
  lines.push(`   Flights: ${flightNums}`);

  if (segments.length > 1) {
    const connections = segments.slice(0, -1).map((s) => s.arrival.iata_code);
    lines.push(`   Via: ${connections.join(", ")}`);
  }

  return lines;
}

/** Round-trip and multi-city offers carry one entry per leg in `items`. */
function offerItems(offer: FlightOffer): FlightOfferItem[] {
  const items = offer.items ?? [];
  return Array.isArray(items) ? items : Object.values(items);
}

function legLabels(legs: FlightItinerary[]): string[] {
  if (legs.length === 1) return ["Outbound"];
  const origin = legs[0].segments?.[0]?.departure.iata_code;
  const lastSegs = legs[1].segments ?? [];
  const returnsHome = legs.length === 2 && origin !== undefined && lastSegs[lastSegs.length - 1]?.arrival.iata_code === origin;
  if (returnsHome) return ["Outbound", "Return"];
  return legs.map((_, i) => `Leg ${i + 1}`);
}

function baggageText(items: FlightOfferItem[]): string {
  const included = items.filter((i) => i.includeBaggage);
  if (included.length === 0) return "No baggage";
  if (included.length < items.length) return "Baggage included on some legs only";
  const first = included[0].include_baggage;
  return first ? `${first.count} ${first.unit} baggage included` : "Baggage included";
}

export function formatMoney(amount: number | string | undefined, sign: string, code: string): string {
  if (amount === undefined || amount === null) return "N/A";
  if (sign) return `${sign}${amount}`;
  return code ? `${amount} ${code}` : String(amount);
}

function formatOffer(
  offer: FlightOffer,
  index: number,
  currency: { sign: string; code: string },
  airlineNames: Record<string, string>,
): string {
  const lines: string[] = [];
  const items = offerItems(offer);
  if (items.length === 0) return `${index}. (no offer data)`;

  const carriers = [...new Set(items.map((i) => i.airline).filter(Boolean))];
  const airlineText = carriers.map((c) => `${airlineNames[c] || c} (${c})`).join(" + ");
  const code = currency.code || items[0].price?.currency || "";
  const price = offer.totalPrice ?? items[0].price?.totalPrice;

  lines.push(`${index}. ${airlineText} | ${formatMoney(price, currency.sign, code)}`);

  const legs = items.flatMap((i) => i.itineraries ?? []);
  const labels = legLabels(legs);
  legs.forEach((leg, i) => lines.push(...formatItinerary(leg, labels[i])));

  const seats = items.map((i) => i.availableSeats).filter((n) => typeof n === "number");
  const seatsText = seats.length > 0 ? ` | ${Math.min(...seats)} seats left` : "";
  lines.push(`   ${items[0].cabinClass} | ${baggageText(items)}${seatsText}`);

  if (offer.id) {
    lines.push(`   (internal — do not show to user) offer_reference=${shortFlightOfferRef(String(offer.id))}`);
  } else {
    lines.push("   (internal — do not show to user) this option has no offer reference and cannot be booked from here");
  }

  return lines.join("\n");
}

function responseCurrency(response: FlightSearchResultsResponse): { sign: string; code: string } {
  return { sign: response.currencySign || "", code: response.currency || "" };
}

export function formatFlightResults(
  response: FlightSearchResultsResponse,
  cacheId: string,
  meta: SearchMeta,
  completed: boolean
): string {
  const lines: string[] = [];

  // Header
  const tripType = meta.returnDate ? "Round trip" : "One way";
  lines.push(`Flight search: ${meta.origin} → ${meta.destination}`);
  lines.push(`${tripType} | ${meta.departureDate}${meta.returnDate ? ` — ${meta.returnDate}` : ""} | ${meta.cabinClass} | ${meta.passengers}`);
  lines.push("");

  if (!completed) {
    lines.push("(Search still in progress — showing partial results)");
    lines.push("");
  }

  const total = response.total || response.items.length;
  lines.push(`Found ${total} flight option(s). Showing ${response.items.length}:\n`);

  const airlineNames = response.airlines || {};
  const currency = responseCurrency(response);

  for (let i = 0; i < response.items.length; i++) {
    lines.push(formatOffer(response.items[i], i + 1, currency, airlineNames));
    if (i < response.items.length - 1) lines.push("");
  }

  if (response.items.length === 0) {
    lines.push("No flights found for this route and date. Try different dates or airports.");
  }

  lines.push("");
  lines.push(`(internal — do not show to user) search_reference=${cacheId}`);

  return lines.join("\n");
}

export function formatFilteredResults(
  response: FlightSearchResultsResponse,
  cacheId: string,
  filterSummary: string
): string {
  const lines: string[] = [];

  lines.push(`Flight results`);
  if (filterSummary) {
    lines.push(`Filters: ${filterSummary}`);
  }

  const total = response.total || response.items.length;
  const offset = response.offset || 0;
  const showing = response.items.length;
  lines.push(`Showing ${offset + 1}–${offset + showing} of ${total} result(s)\n`);

  const airlineNames = response.airlines || {};
  const currency = responseCurrency(response);

  for (let i = 0; i < response.items.length; i++) {
    lines.push(formatOffer(response.items[i], offset + i + 1, currency, airlineNames));
    if (i < response.items.length - 1) lines.push("");
  }

  if (response.items.length === 0) {
    lines.push("No flights match these filters. Try relaxing your criteria.");
  }

  lines.push("");
  lines.push(`(internal — do not show to user) search_reference=${cacheId}`);

  return lines.join("\n");
}
