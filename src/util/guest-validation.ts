export interface GuestForValidation {
  type?: "adult" | "child" | "infant";
  dateOfBirth: string; // strict YYYY-MM-DD
}

/**
 * Compute the integer age (in completed years) of a person born on `birthYmd`
 * as of the date `asOfYmd`.
 */
export function ageAtDate(birthYmd: string, asOfYmd: string): number {
  const [by, bm, bd] = birthYmd.split("-").map(Number);
  const [ay, am, ad] = asOfYmd.split("-").map(Number);
  let age = ay - by;
  if (am < bm || (am === bm && ad < bd)) age -= 1;
  return age;
}

/**
 * Compare child ages declared at hotel-search time with child ages implied by
 * the actual guests at booking time.
 *
 * For adults: age difference search-vs-booking is not enforced — the API only
 * cares about counts. For children: the price and availability depend on the
 * exact age bucket, so MCP must reject mismatches up-front rather than letting
 * the API return the opaque OCCUPANCY_MISMATCH error.
 *
 * `expectedAges` is the multiset of childrenAges that was passed to
 * search_hotels. `guests` are the guests that will be sent to create_order;
 * only entries with type === "child" are checked.
 *
 * Returns null on success, otherwise a human-readable error message.
 */
export function validateChildrenAges(
  expectedAges: number[] | undefined,
  guests: GuestForValidation[],
  checkinYmd: string,
): string | null {
  const expected = (expectedAges ?? []).slice().sort((a, b) => a - b);
  const childGuests = guests.filter((g) => g.type === "child");

  if (expected.length !== childGuests.length) {
    return (
      `Children count mismatch: search expected ${expected.length} child(ren) ` +
      `with ages [${expected.join(", ")}], but ${childGuests.length} child guest(s) ` +
      `were provided. Hotel rate depends on child age — re-search with the correct ` +
      `children, or fix the guest list.`
    );
  }

  if (expected.length === 0) return null;

  const actual = childGuests
    .map((g) => ageAtDate(g.dateOfBirth, checkinYmd))
    .sort((a, b) => a - b);

  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== actual[i]) {
      return (
        `Child age mismatch: search ages [${expected.join(", ")}] vs booking ages ` +
        `[${actual.join(", ")}] (computed at check-in ${checkinYmd}). ` +
        `Hotel rate is locked to the search age — re-search with the actual child ages.`
      );
    }
  }

  return null;
}
