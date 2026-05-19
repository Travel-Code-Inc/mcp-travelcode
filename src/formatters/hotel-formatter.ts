import {
  HotelLocationSearchResponse,
  HotelOffer,
  HotelOffersResponse,
} from "../client/types.js";

export function formatHotelLocations(data: HotelLocationSearchResponse): string {
  if (!data.items || data.items.length === 0) {
    return "No locations found.";
  }

  const lines: string[] = [`Found ${data.items.length} group(s):\n`];

  for (const group of data.items) {
    lines.push(`--- ${group.type.toUpperCase()}: ${group.text} ---`);
    for (const child of group.children) {
      const idHint = group.type === "hotels" ? `(use location: ${child.id})` : `(use location: ${child.id})`;
      const addr = child.address ? ` — ${child.address}` : "";
      lines.push(`  ID: ${child.id} ${idHint}  ${child.name}${addr}  [${child.countryCode}]`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, " ")
    .replace(/<\/?p[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const BOARD_NAMES: Record<string, string> = {
  RO: "Room Only",
  BI: "Breakfast Included",
  LI: "Lunch Included",
  DI: "Dinner Included",
  HB: "Half Board",
  FB: "Full Board",
  AI: "All Inclusive",
};

export function formatHotelResults(
  hotels: HotelOffer[],
  totalCount: number,
  cacheKey?: string,
): string {
  if (hotels.length === 0) {
    return totalCount > 0
      ? `Found ${totalCount} hotels total, but none in the current page. Try adjusting offset/limit or filters.`
      : "No hotels found matching your criteria.";
  }

  const lines: string[] = [`Found ${totalCount} hotels total. Showing ${hotels.length}:\n`];

  for (const hotel of hotels) {
    const starRating = (hotel.starRating as number) ?? (hotel.stars as number);
    const stars = starRating ? "★".repeat(starRating) : "";
    const name = (hotel.propertyName as string) ?? hotel.name ?? "Unknown Hotel";
    const pricePerNight = hotel.price != null ? `$${hotel.price}` : "N/A";
    const totalPrice = (hotel.total as number) != null ? `$${hotel.total}` : "";
    const boardCode = (hotel.boardCode as string) ?? hotel.board ?? "";
    const mealName = (hotel.meal as string) ?? BOARD_NAMES[boardCode] ?? boardCode;
    const refundable = (hotel.refundable as boolean);
    const refundText = refundable === true ? "Refundable" : refundable === false ? "Non-refundable" : "";
    const partner = (hotel.partnerName as string) ?? "";

    lines.push(`${stars} ${name}`);
    lines.push(`  Price: ${pricePerNight}/night${totalPrice ? ` (total: ${totalPrice})` : ""}`);
    if (mealName) lines.push(`  Meal: ${mealName}`);
    const tags = [refundText, partner].filter(Boolean).join(" | ");
    if (tags) lines.push(`  ${tags}`);
    lines.push("");
  }

  if (cacheKey) {
    lines.push("");
    lines.push(`(internal — do not show to user) search_reference=${cacheKey}`);
  }

  return lines.join("\n");
}

export function formatHotelOffers(data: HotelOffersResponse): string {
  const prop = data.property;
  const stars = prop.starRating ? "★".repeat(prop.starRating) : "";
  const lines: string[] = [
    `${stars} ${prop.name}`,
    prop.address ? `Address: ${prop.address}` : "",
    data.hotelUrl ? `Hotel page: ${data.hotelUrl}` : "",
  ].filter(Boolean);

  // Descriptions
  if (prop.description && prop.description.length > 0) {
    for (const desc of prop.description.slice(0, 2)) {
      const text = desc.text.length > 200 ? desc.text.slice(0, 200) + "..." : desc.text;
      lines.push(`${desc.title}: ${text}`);
    }
  }

  const roomGroups = Object.entries(data.offers);
  let totalRates = 0;
  for (const [, group] of roomGroups) {
    totalRates += group.rates.length;
  }

  lines.push("");
  lines.push(`${roomGroups.length} room types, ${totalRates} rates total:`);
  lines.push("");

  for (const [roomName, group] of roomGroups) {
    const cheapest = group.rates.reduce(
      (min, r) => (r.price.nightly < min.price.nightly ? r : min),
      group.rates[0]
    );
    if (!cheapest) continue;

    const refundable = group.rates.some((r) => r.cancelPolicy.refundable);
    const boards = [...new Set(group.rates.map((r) => r.boardName))].join(", ");

    lines.push(`--- ${roomName} (${group.rates.length} offers) ---`);
    lines.push(`  From: ${cheapest.price.nightly} ${cheapest.price.currency}/night (total: ${cheapest.price.total} for ${cheapest.price.nights} night(s))`);
    lines.push(`  Meal options: ${boards}`);
    lines.push(`  ${refundable ? "Refundable options available" : "Non-refundable"}`);

    // Show top 3 rates with their per-rate identifiers and the actual
    // cancellation policy text (title + description + structured rules)
    // so the LLM can quote free-cancellation deadlines and penalties.
    const sorted = [...group.rates].sort((a, b) => a.price.nightly - b.price.nightly);
    for (const rate of sorted.slice(0, 3)) {
      const policy = rate.cancelPolicy;
      const cancelTag = policy.refundable
        ? policy.fullyRefundable
          ? "Fully refundable"
          : "Partially refundable"
        : "Non-refundable";
      // The wire field is `_offerId` (HotelPageService::generateOfferId
      // produces xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx; HotelRateLookup::find
      // looks up rates by exactly this value). Some doc revisions call it
      // `id`, older builds emitted quoteKey/externalId — try in that order
      // so the LLM always passes the value the booker can resolve.
      const offerId =
        rate._offerId ||
        rate.id ||
        rate.quoteKey ||
        rate.externalId;
      lines.push(`    ${rate.price.nightly} ${rate.price.currency}/night | ${rate.boardName} | ${cancelTag}`);
      if (rate.roomName) lines.push(`      Room: ${rate.roomName}`);
      if (policy.title) lines.push(`      Cancellation: ${policy.title}`);
      if (policy.rules && policy.rules.length > 0) {
        for (const r of policy.rules) {
          const v = `${r.value} ${rate.price.currency}`;
          lines.push(`        from ${r.deadline} → penalty ${v}`);
        }
      }
      if (policy.description) {
        const plain = htmlToPlain(policy.description);
        if (plain) lines.push(`      Details: ${plain}`);
      }
      if (rate.remarks) lines.push(`      Remarks: ${rate.remarks}`);
      if (offerId) lines.push(`      (internal — do not show to user) offer_reference=${offerId}`);
    }
    if (sorted.length > 3) {
      lines.push(`    ... and ${sorted.length - 3} more offers`);
    }
    lines.push("");
  }

  // Top-level session id for create_order. Canonical field per the REST
  // contract is `sessionId`; legacy deployments used `offersKey`/`offerKey`/
  // `cacheKey`. Try them in order so the LLM always has the right token.
  const raw = data as unknown as Record<string, unknown>;
  const sessionId =
    (typeof raw.sessionId === "string" && raw.sessionId) ||
    (typeof raw.offersKey === "string" && raw.offersKey) ||
    (typeof raw.offerKey === "string" && raw.offerKey) ||
    (typeof raw.cacheKey === "string" && raw.cacheKey) ||
    "";
  lines.push("");
  if (sessionId) {
    lines.push(`(internal — do not show to user) search_reference=${sessionId}`);
  } else {
    lines.push(
      "(internal — do not show to user) search_reference is missing; re-run the hotel search and try again.",
    );
  }

  return lines.join("\n");
}
