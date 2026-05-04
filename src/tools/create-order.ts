import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  TravelCodeApiClient,
  TravelCodeOfferChangedError,
} from "../client/api-client.js";
import { OrderFull } from "../client/types.js";
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

const documentSchema = z.object({
  type: z
    .string()
    .optional()
    .describe(
      "Document type, free uppercase string. Defaults to PASSPORT. Examples: PASSPORT, ID_CARD, BIRTH_CERTIFICATE.",
    ),
  number: z.string().describe("Document number (spaces will be stripped server-side)"),
  expiryDate: z
    .string()
    .optional()
    .describe(
      "Expiry date in any common format (YYYY-MM-DD preferred; DD.MM.YYYY accepted). MCP will normalize to YYYY-MM-DD.",
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
  gender: z.enum(["M", "F"]).describe("Gender"),
  dateOfBirth: z
    .string()
    .describe(
      "Date of birth in any common format (YYYY-MM-DD preferred; DD.MM.YYYY accepted). MCP normalizes to YYYY-MM-DD.",
    ),
  nationality: z
    .string()
    .describe(
      "Guest nationality, ISO-2 country code (BY, RU, US, ...). Required by the API. " +
        "For hotels, the lead-guest nationality MUST match the country_code that was used in search_hotels.",
    ),
  contacts: contactsSchema.optional().describe("Contact info — strongly recommended for the lead guest"),
  document: documentSchema.optional().describe("Travel document. Optional but usually required for hotel bookings."),
});

const roomSchema = z.object({
  guests: z.array(guestSchema).min(1).describe("Guests sharing this room (lead first)"),
  specialRequest: z.string().optional().describe("Free-text special request for this room"),
});

export const createOrderSchema = {
  service_type: z
    .enum(["hotel", "flight"])
    .describe("What is being booked. Determines which guest layout is required."),
  session_id: z
    .string()
    .describe(
      "Search session id. From search_flights it is `cacheId`; from search_hotels it is the cacheKey returned by the hotel search.",
    ),
  offer_id: z
    .union([z.number(), z.string()])
    .describe(
      "Offer identifier from the search response. For flights — index in the items[] array; for hotels — the offer/quote key.",
    ),
  passengers: z
    .array(guestSchema)
    .optional()
    .describe("Flight passengers. Required when service_type=flight."),
  rooms: z
    .array(roomSchema)
    .optional()
    .describe("Hotel rooms with their guests. Required when service_type=hotel."),
  payment_method: z
    .enum(["wallet", "card"])
    .optional()
    .describe("Optional preferred payment method. Omit to let the agency default decide."),
  book_key: z
    .string()
    .optional()
    .describe(
      "Required ONLY when retrying after a 409 offer_changed response. Pass the bookKey from that response after the user has explicitly confirmed the new price/policy. Never auto-retry.",
    ),
  idempotency_key: z
    .string()
    .optional()
    .describe(
      "UUID for duplicate protection. If repeated within 24h with the same body, the same order is returned without re-booking. Strongly recommended.",
    ),
  expected_children_ages: z
    .array(z.number().int().min(0).max(17))
    .optional()
    .describe(
      "Hotel only — the childrenAges array that was passed to search_hotels. MCP validates locally that booking guests of type=child have matching ages at check-in, so the user gets a clear error before the API does.",
    ),
  checkin: z
    .string()
    .optional()
    .describe(
      "Hotel check-in date (used only for local children-age validation). Strongly recommended whenever expected_children_ages is set.",
    ),
};

function normalizeGuest<T extends { dateOfBirth: string; document?: { expiryDate?: string; issuedAt?: string } | undefined }>(
  guest: T,
  pathPrefix: string,
): T {
  const out: T = { ...guest };
  out.dateOfBirth = normalizeDate(guest.dateOfBirth, `${pathPrefix}.dateOfBirth`);
  if (guest.document) {
    const doc = { ...guest.document };
    if (doc.expiryDate) {
      doc.expiryDate = normalizeDate(doc.expiryDate, `${pathPrefix}.document.expiryDate`);
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
      "Book a hotel or flight from a cached search offer.",
      "",
      "Flow:",
      "  1. flights: search_flights → pick offer → create_order(service_type='flight', passengers=[...]).",
      "  2. hotels:  search_hotels → get_hotel_offers → pick rate → create_order(service_type='hotel', rooms=[{guests:[...]}]).",
      "",
      "Role-based behavior (from get_current_user, called once at session start):",
      "  • role = 'employee_traveller': always book for exactly 1 person using the tourist returned by get_first_client. Hotels: just confirm first/last name with the user before calling this tool — do not ask anything else. Flights: also pick a document — if the tourist has multiple documents in `docs[]`, ask the user which to use; if they have only one, auto-pick it. Refuse the call if more than one passenger/guest is supplied.",
      "  • role = 'developer': prefix your user-facing reply (after a successful booking or on a 409) with '[Developer mode]' so the user knows the action ran in dev mode.",
      "",
      "Guest data — hotel client-selection rules:",
      "  • The lead guest's `nationality` MUST equal the `country_code` used in search_hotels.",
      "  • For 1-adult hotel bookings where the user did not supply nationality, call get_first_client first and propose that traveler. If the user accepts, use their data. If they reject, ask only for the lead guest's nationality at search time, then collect full details before this call.",
      "  • For multi-adult hotels, ask only the lead guest's nationality at search; gather all guest passport details before booking.",
      "  • Children: their ages at check-in must match the childrenAges from search exactly. Pass `expected_children_ages` and `checkin` so MCP validates locally and returns a clear message instead of the API's OCCUPANCY_MISMATCH.",
      "  • Adults' search-vs-booking age difference is NOT enforced.",
      "",
      "On a 409 offer_changed response: do NOT retry automatically. Show the diff (price / cancel-policy) to the user, get explicit confirmation, then call this tool again with the exact same arguments plus `book_key` from the previous error.",
      "",
      "Dates: any common format is accepted (MCP normalizes to YYYY-MM-DD). If a date is ambiguous (e.g. 03.04.2026 with no locale clue) MCP will fail and you must re-ask the user.",
    ].join("\n"),
    createOrderSchema,
    async ({
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
              content: [{ type: "text", text: "create_order(service_type='flight') requires `passengers`." }],
              isError: true,
            };
          }
          if (rooms) {
            return {
              content: [{ type: "text", text: "create_order(service_type='flight') does not accept `rooms`." }],
              isError: true,
            };
          }
        } else {
          if (!rooms || rooms.length === 0) {
            return {
              content: [{ type: "text", text: "create_order(service_type='hotel') requires `rooms` with at least one room." }],
              isError: true,
            };
          }
          if (passengers) {
            return {
              content: [{ type: "text", text: "create_order(service_type='hotel') does not accept `passengers`. Use `rooms[].guests`." }],
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
                text: "When passing expected_children_ages you must also pass `checkin` (the hotel check-in date) so MCP can compute the child age at check-in.",
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

        const order = await client.post<OrderFull>("/orders", body, extraHeaders);
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
            `OFFER_CHANGED: hotel rate changed before booking (reason: ${d.reason ?? "unknown"}).`,
            `Show the diff below to the user, get explicit confirmation, then retry create_order with the same args plus book_key="${d.bookKey}".`,
            "",
            "Previous: " + JSON.stringify(d.previous ?? null),
            "Current:  " + JSON.stringify(d.current ?? null),
          ];
          if (d.expiresAt) {
            lines.push(`bookKey expires at unix=${d.expiresAt}.`);
          }
          return { content: [{ type: "text", text: lines.join("\n") }], isError: true };
        }
        return {
          content: [{ type: "text", text: `Error creating order: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
