import { FlightOffer, FlightSearchResultsResponse, FlightItinerary } from "../client/types.js";

interface SearchMeta {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  cabinClass: string;
  passengers: string;
}

function formatItinerary(itinerary: FlightItinerary, label: string): string[] {
  const lines: string[] = [];
  const segments = itinerary.segments;

  if (segments.length === 0) return lines;

  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];

  const depTime = firstSeg.departure.at.split("T")[1]?.substring(0, 5) || "";
  const arrTime = lastSeg.arrival.at.split("T")[1]?.substring(0, 5) || "";
  const depCode = firstSeg.departure.iata_code;
  const arrCode = lastSeg.arrival.iata_code;

  const stops = itinerary.transfers;
  const stopsText = stops === 0 ? "Direct" : stops === 1 ? "1 stop" : `${stops} stops`;

  // Flight numbers
  const flightNums = segments.map((s) => `${s.carrier_code}${s.number}`).join(", ");

  lines.push(`   ${label}: ${depCode} ${depTime} → ${arrCode} ${arrTime} (${itinerary.duration}) | ${stopsText}`);
  lines.push(`   Flights: ${flightNums}`);

  // Show layover airports for connecting flights
  if (stops > 0) {
    const connections = segments.slice(0, -1).map((s) => s.arrival.iata_code);
    lines.push(`   Via: ${connections.join(", ")}`);
  }

  return lines;
}

function formatOffer(offer: FlightOffer, index: number, currencySign: string, airlineNames: Record<string, string>): string {
  const lines: string[] = [];
  const item = offer.items[0];
  if (!item) return `${index}. (no offer data)`;

  const airlineName = airlineNames[item.airline] || item.airline;
  const baggageText = item.includeBaggage
    ? item.include_baggage
      ? `${item.include_baggage.count} ${item.include_baggage.unit} baggage included`
      : "Baggage included"
    : "No baggage";

  lines.push(`${index}. ${airlineName} (${item.airline}) | ${currencySign}${offer.totalPrice}`);

  // Itineraries
  const itineraries = item.itineraries;
  if (itineraries.length >= 1) {
    lines.push(...formatItinerary(itineraries[0], "Outbound"));
  }
  if (itineraries.length >= 2) {
    lines.push(...formatItinerary(itineraries[1], "Return"));
  }

  lines.push(`   ${item.cabinClass} | ${baggageText} | ${item.availableSeats} seats left`);

  return lines.join("\n");
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
  const currencySign = response.currencySign || response.currency || "$";

  for (let i = 0; i < response.items.length; i++) {
    lines.push(formatOffer(response.items[i], i + 1, currencySign, airlineNames));
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
  const currencySign = response.currencySign || response.currency || "$";

  for (let i = 0; i < response.items.length; i++) {
    lines.push(formatOffer(response.items[i], offset + i + 1, currencySign, airlineNames));
    if (i < response.items.length - 1) lines.push("");
  }

  if (response.items.length === 0) {
    lines.push("No flights match these filters. Try relaxing your criteria.");
  }

  lines.push("");
  lines.push(`(internal — do not show to user) search_reference=${cacheId}`);

  return lines.join("\n");
}
