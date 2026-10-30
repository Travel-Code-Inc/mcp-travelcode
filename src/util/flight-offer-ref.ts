import { createHash } from "node:crypto";
import { TravelCodeApiClient } from "../client/api-client.js";
import { FlightSearchResultsResponse } from "../client/types.js";

/**
 * Flight offers are booked by the `id` the results endpoint serves for each
 * offer group. That id can be tens of KB (some sources pack the whole offer
 * into it), so the model only ever sees a short digest of it; create_order
 * maps the digest back by re-reading the same search.
 */
const SHORT_REF = /^f_[0-9a-f]{16}$/;
const PAGE_SIZE = 250;
const MAX_PAGES = 2;

export function shortFlightOfferRef(servedId: string): string {
  return `f_${createHash("sha1").update(servedId).digest("hex").slice(0, 16)}`;
}

export function isShortFlightOfferRef(value: string): boolean {
  return SHORT_REF.test(value);
}

/** The served id behind a short reference, or null when the search no longer lists it. */
export async function resolveFlightOfferRef(
  client: TravelCodeApiClient,
  searchId: string,
  ref: string,
): Promise<string | null> {
  for (let page = 0; page < MAX_PAGES; page++) {
    const results = await client.get<FlightSearchResultsResponse>(
      `/search/flights/${encodeURIComponent(searchId)}`,
      { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    );
    const groups = results.items ?? [];
    const hit = groups.find((g) => g.id && shortFlightOfferRef(String(g.id)) === ref);
    if (hit?.id) return String(hit.id);
    if (groups.length < PAGE_SIZE) return null;
  }
  return null;
}
