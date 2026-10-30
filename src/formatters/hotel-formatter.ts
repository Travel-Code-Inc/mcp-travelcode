import {
  HotelLocationSearchResponse,
  HotelOffer,
  HotelOfferCancelPolicy,
  HotelOffersResponse,
} from "../client/types.js";

const MAX_ROOM_GROUPS = 12;
const NO_REFUND_TITLE = /не предусмотрен|невозвратн|non[\s-]?refundable/i;

export interface RateRefundability {
  refundable: boolean;
  /** Supplier-local deadline string, exactly as the supplier sent it. */
  freeCancellationUntil?: string;
}

/** "YYYY-MM-DD HH:MM:SS" (or with a "T") → comparable "YYYY-MM-DD HH:MM:SS". */
function comparableDeadline(deadline: string): string {
  return deadline.trim().replace("T", " ").slice(0, 19);
}

/**
 * The supplier's `refundable` flag stays true on rates whose title says no
 * refund and whose first penalty has already started, so derive it instead.
 * Deadlines are zone-less supplier-local strings; they are compared as given
 * against the current UTC time, which is close enough to tell "already
 * started" from "still ahead" — the original string is what the user sees.
 */
export function rateRefundability(policy: HotelOfferCancelPolicy | undefined, now: Date = new Date()): RateRefundability {
  if (!policy || policy.refundable !== true) return { refundable: false };
  if (policy.title && NO_REFUND_TITLE.test(policy.title)) return { refundable: false };

  const penalised = (policy.rules ?? [])
    .filter((r) => r.deadline && Number(r.value) > 0)
    .sort((a, b) => comparableDeadline(a.deadline).localeCompare(comparableDeadline(b.deadline)));
  const first = penalised[0];
  if (!first) return { refundable: true };

  const nowText = now.toISOString().replace("T", " ").slice(0, 19);
  if (comparableDeadline(first.deadline) <= nowText) return { refundable: false };

  return { refundable: true, freeCancellationUntil: first.deadline };
}

function formatAmount(amount: unknown, currency: string | undefined): string {
  if (amount === undefined || amount === null || amount === "") return "";
  return currency ? `${amount} ${currency}` : String(amount);
}

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

/** Some suppliers' list items carry no top-level currency; their quote block does. */
function hotelCurrency(hotel: HotelOffer): string | undefined {
  const quote = hotel.quiQuo as { currency?: unknown } | undefined;
  const candidates = [hotel.currency, quote?.currency, hotel.currencySign];
  return candidates.find((c): c is string => typeof c === "string" && c !== "");
}

export function formatHotelResults(
  hotels: HotelOffer[],
  totalCount: number,
  cacheKey?: string,
  policy?: { policyHidesOffers?: boolean; hiddenByPolicy?: number },
): string {
  const hidden = policy?.policyHidesOffers ? policy.hiddenByPolicy ?? 0 : 0;
  const hiddenLine =
    hidden > 0
      ? `${hidden} hotel${hidden === 1 ? "" : "s"} hidden by your travel policy.`
      : "";

  if (hotels.length === 0) {
    if (hidden > 0) {
      return `No hotels available under your travel policy — ${hidden} hotel${hidden === 1 ? " was" : "s were"} hidden because they exceed its limits.`;
    }
    return totalCount > 0
      ? `Found ${totalCount} hotels total, but none in the current page. Try adjusting offset/limit or filters.`
      : "No hotels found matching your criteria.";
  }

  const lines: string[] = [`Found ${totalCount} hotels total. Showing ${hotels.length}:`];
  if (hiddenLine) lines.push(hiddenLine);
  lines.push("");

  for (const hotel of hotels) {
    const starRating = (hotel.starRating as number) ?? (hotel.stars as number);
    const stars = starRating ? "★".repeat(starRating) : "";
    const name = (hotel.propertyName as string) ?? hotel.name ?? "Unknown Hotel";
    const currency = hotelCurrency(hotel);
    const pricePerNight = hotel.price != null ? formatAmount(hotel.price, currency) : "N/A";
    const totalPrice = formatAmount(hotel.total, currency);
    const boardCode = (hotel.boardCode as string) ?? hotel.board ?? "";
    const mealName = (hotel.meal as string) ?? BOARD_NAMES[boardCode] ?? boardCode;
    const refundable = (hotel.refundable as boolean);
    const refundText = refundable === true ? "Refundable" : refundable === false ? "Non-refundable" : "";

    lines.push(`${stars} ${name}`);
    lines.push(`  Price: ${pricePerNight}/night${totalPrice ? ` (total: ${totalPrice})` : ""}`);
    if (mealName) lines.push(`  Meal: ${mealName}`);
    if (refundText) lines.push(`  ${refundText}`);
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

  // Travel policy: when the caller's policy hides violating offers, explain why
  // the offer set is reduced (or empty). Surface reasons to the user.
  const policyReasons = data.policyReasons ?? [];
  if (data.policyRestricted && policyReasons.length > 0) {
    lines.push("");
    if (totalRates === 0) {
      lines.push("No offers available under your travel policy. Reason(s):");
    } else {
      lines.push("Some offers are hidden by your travel policy. Reason(s):");
    }
    for (const reason of policyReasons) {
      lines.push(`  • ${reason}`);
    }
  }

  lines.push("");
  lines.push(`${roomGroups.length} room types, ${totalRates} rates total:`);
  lines.push("");

  const shownGroups = roomGroups.slice(0, MAX_ROOM_GROUPS);

  for (const [roomName, group] of shownGroups) {
    const cheapest = group.rates.reduce(
      (min, r) => (r.price.nightly < min.price.nightly ? r : min),
      group.rates[0]
    );
    if (!cheapest) continue;

    const refundable = group.rates.some((r) => rateRefundability(r.cancelPolicy).refundable);
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
      const policy = rate.cancelPolicy ?? { refundable: false, fullyRefundable: false, title: "" };
      const refund = rateRefundability(policy);
      const cancelTag = !refund.refundable
        ? "Non-refundable"
        : refund.freeCancellationUntil
          ? `Free cancellation until ${refund.freeCancellationUntil} (hotel local time)`
          : policy.fullyRefundable
            ? "Fully refundable"
            : "Partially refundable";
      // The REST offers response serializes the booker's `_offerId` as `id`
      // (HotelRateLookup::find matches on it); `_offerId` and the older
      // quoteKey/externalId are fallbacks for legacy builds.
      const offerId =
        rate.id ||
        rate._offerId ||
        rate.quoteKey ||
        rate.externalId;
      const policyTag = rate.outOfPolicy ? " | Out of travel policy" : "";
      lines.push(`    ${rate.price.nightly} ${rate.price.currency}/night | ${rate.boardName} | ${cancelTag}${policyTag}`);
      if (rate.roomName) lines.push(`      Room: ${rate.roomName}`);
      if (rate.outOfPolicy && rate.policyReasons && rate.policyReasons.length > 0) {
        lines.push(`      Policy: ${rate.policyReasons.join("; ")}`);
      }
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

  if (roomGroups.length > shownGroups.length) {
    lines.push(`... and ${roomGroups.length - shownGroups.length} more room types not shown.`);
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
