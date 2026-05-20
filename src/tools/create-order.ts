import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  TravelCodeApiClient,
  TravelCodeOfferChangedError,
} from "../client/api-client.js";
import { OrderEnvelope, OrderFull } from "../client/types.js";
import { formatOrderDetail } from "../formatters/order-formatter.js";
import {
  AmbiguousDateError,
  InvalidDateError,
  normalizeDate,
} from "../util/date.js";
import {
  GuestForValidation,
  validateChildrenAges,
} from "../util/guest-validation.js";
import { impersonationInputSchema, withImpersonation } from "../util/impersonation-tool.js";

const documentSchema = z.object({
  type: z
    .string()
    .optional()
    .describe(
      "Document type, free string. Defaults to 'passport'. Examples: passport, id_card, birth_certificate.",
    ),
  number: z.string().describe("Document number (spaces will be stripped server-side)"),
  expiryDate: z
    .string()
    .optional()
    .describe(
      "Expiry date in any common format (YYYY-MM-DD preferred; DD.MM.YYYY accepted). MCP normalizes to YYYY-MM-DD before sending.",
    ),
  issuedAt: z
    .string()
    .optional()
    .describe("Issue date, same format rules as expiryDate."),
  nationality: z
    .string()
    .optional()
    .describe(
      "Document-issuing country ISO-2 code (e.g. BY, RU, US). Defaults to the guest's nationality.",
    ),
});

const contactsSchema = z.object({
  email: z.string().optional().describe("Email address (recommended for the lead guest)"),
  phone: z.string().optional().describe("Phone with country code, e.g. +375291234567"),
});

const guestSchema = z.object({
  type: z
    .enum(["adult", "child", "infant"])
    .optional()
    .describe(
      "Guest type. If omitted, will be inferred server-side from dateOfBirth. " +
        "For hotel bookings, child/infant ages must match the search occupancy.",
    ),
  firstName: z.string().describe("First name in Latin characters"),
  lastName: z.string().describe("Last name in Latin characters"),
  gender: z.enum(["M", "F"]).optional().describe("Gender (optional for hotels)"),
  dateOfBirth: z
    .string()
    .describe(
      "Date of birth in any common format (YYYY-MM-DD preferred; DD.MM.YYYY accepted). MCP normalizes to YYYY-MM-DD before sending.",
    ),
  nationality: z
    .string()
    .describe(
      "Guest nationality, ISO-2 country code (BY, RU, US, ...). Required by the API. " +
        "For hotels, the lead-guest nationality MUST match the country_code that was used in search_hotels.",
    ),
  isMain: z
    .boolean()
    .optional()
    .describe(
      "Mark the lead guest of a hotel room. Set true for exactly one guest per room (the contact / responsible adult).",
    ),
  contacts: contactsSchema.optional().describe("Contact info — strongly recommended for the lead guest"),
  document: documentSchema.optional().describe(
    "Travel document. REQUIRED for flights (the airline ticket is bound to the passport number). " +
      "OPTIONAL for hotels — most hotels accept a booking with just first/last name + nationality + DOB. " +
      "Do NOT ask the user for passport data when booking a hotel unless the user volunteers it.",
  ),
});

const roomSchema = z.object({
  guests: z.array(guestSchema).min(1).describe("Guests sharing this room (lead first)"),
  specialRequest: z.string().optional().describe("Free-text special request for this room"),
});

export const createOrderSchema = {
  service_type: z
    .enum(["hotel", "flight"])
    .describe("What is being booked: 'hotel' or 'flight'."),
  session_id: z
    .string()
    .describe(
      "The internal search reference printed at the bottom of the prior search tool. Copy verbatim, never show to the user.",
    ),
  offer_id: z
    .union([z.number(), z.string()])
    .describe(
      "The internal offer reference for the option the user picked (printed under each option by the prior tool). " +
        "For flights it's the position of the chosen flight in the result list; for hotels it's an opaque token. " +
        "Copy verbatim, never show to the user.",
    ),
  passengers: z
    .array(guestSchema)
    .optional()
    .describe("Travelers for a flight booking. Required for flights."),
  rooms: z
    .array(roomSchema)
    .optional()
    .describe("Rooms (each with its guests) for a hotel booking. Required for hotels."),
  payment_method: z
    .string()
    .optional()
    .describe(
      "Optional preferred payment method. Common values: 'card', 'deposit' (corp wallet balance), 'bill' (invoice). Defaults vary per account — omit to use the account default.",
    ),
  book_key: z
    .string()
    .optional()
    .describe(
      "Internal retry token, set ONLY when retrying after the previous attempt reported that the offer changed and the user explicitly confirmed the new terms. Never narrate this to the user.",
    ),
  idempotency_key: z
    .string()
    .optional()
    .describe(
      "Optional UUID for duplicate protection: if the same call repeats within 24h, the same booking is returned without re-booking. Recommended.",
    ),
  expected_children_ages: z
    .array(z.number().int().min(0).max(17))
    .optional()
    .describe(
      "Hotel only — the children's ages used at search time. We compare them to the booking guests so a mismatch fails fast with a clear, plain-language message.",
    ),
  checkin: z
    .string()
    .optional()
    .describe(
      "Hotel check-in date (used to compute the children's ages on that day). Required when children's ages are passed.",
    ),
};

/**
 * Normalize the date fields on a guest. The upstream booker validates
 * `dateOfBirth` and `document.expiryDate`; the published API doc shows
 * `birthDate` and `document.expiry`. We send the canonical names AND the
 * doc-style aliases so we are tolerant of both implementations.
 */
function normalizeGuest<
  T extends {
    dateOfBirth: string;
    birthDate?: string;
    document?: { expiryDate?: string; expiry?: string; issuedAt?: string } | undefined;
  },
>(guest: T, pathPrefix: string): T {
  const out: T = { ...guest };
  const dob = normalizeDate(guest.dateOfBirth, `${pathPrefix}.dateOfBirth`);
  out.dateOfBirth = dob;
  out.birthDate = dob;
  if (guest.document) {
    const doc = { ...guest.document };
    const rawExpiry = doc.expiryDate ?? doc.expiry;
    if (rawExpiry) {
      const exp = normalizeDate(rawExpiry, `${pathPrefix}.document.expiryDate`);
      doc.expiryDate = exp;
      doc.expiry = exp;
    }
    if (doc.issuedAt) {
      doc.issuedAt = normalizeDate(doc.issuedAt, `${pathPrefix}.document.issuedAt`);
    }
    out.document = doc;
  }
  return out;
}

export function registerCreateOrder(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "create_order",
    [
      "Create a booking. Works for both hotel and flight reservations from a search the user just did.",
      "",
      "USER-FACING LANGUAGE (mandatory):",
      "  • Talk to the user in plain language only. Never quote internal labels or values: search reference, offer reference, session id, offer id, booking id, cache key, quote key, external id, REST routes (POST /v1/orders, etc.), error codes (OFFER_EXPIRED, OCCUPANCY_MISMATCH, 409, etc.), parameter names from the tool schema (service_type, session_id, offer_id, book_key, …) — none of those go into messages to the user.",
      "  • Talk about: 'this offer', 'the hotel/flight you picked', 'your booking', 'the cancellation rules', 'check-in date', 'create the booking', 'cancel the booking', 'change the booking', 'the search'.",
      "  • The 'View booking: <url>' line on a successful booking IS for the user — render it as a friendly clickable link so they can open the booking in the agency dashboard. Do not show the raw URL string in chat.",
      "  • If something fails, describe the cause in plain words ('the offer expired before booking', 'the price changed', 'this room is sold out', 'the room is unavailable for this nationality') — never copy the technical message verbatim.",
      "",
      "How to wire the call (internal — never narrate to the user):",
      "  • Hotels: take the rate the user picked from get_hotel_offers, copy its offer_reference into offer_id and the search_reference at the bottom of get_hotel_offers (or, if missing, the search_reference at the bottom of search_hotels) into session_id, build rooms[].guests, set service_type='hotel'.",
      "  • Flights: take the search_reference from search_flights (or get_flight_results), the position of the chosen flight in the result list (1-based index → 0-based number), pass passengers, set service_type='flight'.",
      "",
      "Traveler data:",
      "  • FLIGHT — passport (number, expiry, document nationality) is mandatory. Ask the user if not already on the saved profile.",
      "  • HOTEL — only first name, last name (both Latin), gender, date of birth, and nationality are mandatory. Passport is OPTIONAL — do not ask for it unless the user volunteers it. Email/phone of the lead guest are nice to have, not required.",
      "  • Lead-guest nationality on a hotel must match the nationality used at search time.",
      "  • Children at hotel: ages at check-in must match the ages used at search. Pass them through together with the check-in date so we validate locally and fail with a plain-language message before the booker is even called.",
      "",
      "Role rules (from get_current_user):",
      "  • Traveller (employee_traveller): exactly 1 person, using the user's only saved tourist. For hotels just confirm first/last name; for flights also pick a document if the tourist has more than one. Refuse multi-guest bookings.",
      "  • Developer: prefix the reply to the user with '[Developer mode]'.",
      "",
      "If the offer changed between search and booking (price or cancellation rules differ): describe the change in plain words, ask the user to confirm explicitly, then retry the booking — never auto-retry. The retry token is opaque; do not show it to the user.",
      "",
      "Dates: accept any common format from the user; we normalize internally. If a date is ambiguous (e.g. 03.04.2026 with no locale clue), the call fails and you must re-ask the user.",
    ].join("\n"),
    { ...createOrderSchema, ...impersonationInputSchema },
    withImpersonation(async ({
      service_type,
      session_id,
      offer_id,
      passengers,
      rooms,
      payment_method,
      book_key,
      idempotency_key,
      expected_children_ages,
      checkin,
    }) => {
      try {
        if (service_type === "flight") {
          if (!passengers || passengers.length === 0) {
            return {
              content: [{ type: "text", text: "Internal: a flight booking requires the list of travelers. Tell the user there was an internal issue building the request." }],
              isError: true,
            };
          }
          if (rooms) {
            return {
              content: [{ type: "text", text: "Internal: a flight booking does not accept rooms — only the list of travelers. Tell the user there was an internal issue building the request." }],
              isError: true,
            };
          }
        } else {
          if (!rooms || rooms.length === 0) {
            return {
              content: [{ type: "text", text: "Internal: a hotel booking requires at least one room with its guests. Tell the user there was an internal issue building the request." }],
              isError: true,
            };
          }
          if (passengers) {
            return {
              content: [{ type: "text", text: "Internal: a hotel booking expects rooms with guests, not a flat list of travelers. Tell the user there was an internal issue building the request." }],
              isError: true,
            };
          }
        }

        const normalizedPassengers = passengers?.map((p, i) => normalizeGuest(p, `passengers.${i}`));
        const normalizedRooms = rooms?.map((r, ri) => ({
          ...r,
          guests: r.guests.map((g, gi) => normalizeGuest(g, `rooms.${ri}.guests.${gi}`)),
        }));

        if (service_type === "hotel" && expected_children_ages !== undefined) {
          if (!checkin) {
            return {
              content: [{
                type: "text",
                text: "Internal: when children's ages are provided, the hotel check-in date is needed to compute their age. Tell the user there was an internal issue building the request.",
              }],
              isError: true,
            };
          }
          const checkinYmd = normalizeDate(checkin, "checkin");
          const allGuests: GuestForValidation[] = (normalizedRooms ?? []).flatMap((r) => r.guests);
          const err = validateChildrenAges(expected_children_ages, allGuests, checkinYmd);
          if (err) {
            return { content: [{ type: "text", text: err }], isError: true };
          }
        }

        const body: Record<string, unknown> = {
          serviceType: service_type,
          sessionId: session_id,
          offerId: offer_id,
        };
        if (payment_method) body.paymentMethod = payment_method;
        if (book_key) body.bookKey = book_key;
        if (normalizedPassengers) body.passengers = normalizedPassengers;
        if (normalizedRooms) body.rooms = normalizedRooms;

        const extraHeaders: Record<string, string> = {};
        if (idempotency_key) extraHeaders["Idempotency-Key"] = idempotency_key;

        const raw = await client.post<OrderEnvelope | OrderFull>(
          "/orders",
          body,
          extraHeaders,
        );
        // POST /v1/orders wraps the payload in `{ order: ... }`. Older builds
        // returned the order at the top level; tolerate both.
        const order: OrderFull =
          (raw as OrderEnvelope).order ?? (raw as OrderFull);
        return { content: [{ type: "text", text: formatOrderDetail(order) }] };
      } catch (error) {
        if (error instanceof AmbiguousDateError || error instanceof InvalidDateError) {
          return {
            content: [{ type: "text", text: error.message }],
            isError: true,
          };
        }
        if (error instanceof TravelCodeOfferChangedError) {
          const d = error.details;
          const lines = [
            "The hotel rate changed before booking. Describe the change to the user in plain language, get explicit confirmation, then call this tool again with exactly the same arguments — the retry token below goes into book_key.",
            "Never show the user the words 'book_key', 'session_id', 'offer_id', 'OFFER_CHANGED', 'bookKey' or any other internal label. Just say something like: 'The price/cancellation rules just changed: <plain summary>. Want me to book at the new terms?'",
            "",
            `(internal — do not show to user) retry_token=${d.bookKey}`,
            `(internal — do not show to user) reason=${d.reason ?? "unknown"}`,
            `(internal — do not show to user) previous=${JSON.stringify(d.previous ?? null)}`,
            `(internal — do not show to user) current=${JSON.stringify(d.current ?? null)}`,
          ];
          if (d.expiresAt) {
            lines.push(`(internal — do not show to user) retry_token_expires_unix=${d.expiresAt}`);
          }
          return { content: [{ type: "text", text: lines.join("\n") }], isError: true };
        }
        return {
          content: [{ type: "text", text: `Error creating order: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }),
  );
}
