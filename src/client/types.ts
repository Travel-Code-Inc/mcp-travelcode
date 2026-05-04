// --- Airports ---

export interface AirportCountry {
  title: string;
  titleEn: string;
  code: string;
}

export interface AirportCity {
  code: string;
  title: string;
  titleEn: string;
}

export interface Airport {
  id: string | number;
  code: string;
  title: string;
  titleEn: string;
  country?: AirportCountry;
  city?: AirportCity;
  isAirport?: boolean;
  sort?: number;
}

// --- Airlines ---

export interface Airline {
  id: number;
  code: string;
  title: string;
}

// --- Flight Search ---

export interface FlightSearchRequest {
  locationFrom: string;
  locationTo: string;
  date: string; // DD.MM.YYYY
  dateEnd?: string; // DD.MM.YYYY or empty for one-way
  cabinClass: string;
  adults: number;
  children: number;
  infants: number;
  airlines?: string[];
}

export interface FlightSearchCreateResponse {
  status: string;
  errors: string[];
  warnings: string[];
  cacheId: string;
  countServices: number;
  countFinishedServices: number;
  countFailedServices: number;
  count: number;
  completed: boolean;
}

// --- Flight Search Results ---

export interface FlightSegmentEndpoint {
  iata_code: string;
  at: string; // ISO 8601
  terminal: string;
  airport: {
    iata_code: string;
    title: string;
  };
}

export interface FlightSegment {
  departure: FlightSegmentEndpoint;
  arrival: FlightSegmentEndpoint;
  carrier_code: string;
  number: string;
  duration: string;
  cabin: string;
}

export interface FlightItinerary {
  duration: string;
  segments: FlightSegment[];
  transfers: number;
}

export interface FlightPrice {
  currency: string;
  totalPrice: number;
  inclusivePrice: number;
  exclusivePrice: number;
}

export interface FlightOfferItem {
  service: string;
  type: string; // "rt" for round-trip, "ow" for one-way
  availableSeats: number;
  cabinClass: string;
  airline: string;
  includeBaggage: boolean;
  include_baggage?: {
    count: number;
    unit: string;
  };
  price: FlightPrice;
  itineraries: FlightItinerary[];
  id: number;
}

export interface FlightOffer {
  totalPrice: number;
  totalPriceNet: number;
  durationTime: string;
  items: FlightOfferItem[];
}

export interface DictionaryAirport {
  title: string;
  titleEn: string;
  city?: {
    code: string;
    title: string;
    titleEn: string;
  };
  country?: {
    code: string;
    title: string;
    titleEn: string;
  };
}

export interface FlightSearchResultsResponse {
  status: string;
  cacheId: string;
  items: FlightOffer[];
  total: number;
  limit: number;
  offset: number;
  currency: string;
  currencySign: string;
  completed?: boolean;
  countServices?: number;
  countFinishedServices?: number;
  countFailedServices?: number;
  count?: number;
  airlines?: Record<string, string>;
  filters?: string[];
  dictionaries?: {
    airports?: Record<string, DictionaryAirport>;
  };
}

// --- Flight Status ---

export interface FlightTime {
  utc?: string;
  local?: string;
}

export interface FlightEndpoint {
  airport?: {
    icao?: string;
    iata?: string;
    name?: string;
    shortName?: string;
    municipalityName?: string;
    location?: { lat?: number; lon?: number };
    countryCode?: string;
  };
  scheduledTime?: FlightTime;
  revisedTime?: FlightTime;
  predictedTime?: FlightTime;
  actualTime?: FlightTime;
  terminal?: string;
  gate?: string;
  baggageBelt?: string;
  checkInDesk?: string;
  quality?: string[];
}

export interface FlightAircraft {
  reg?: string;
  modeS?: string;
  model?: string;
  image?: {
    url?: string;
    webUrl?: string;
    author?: string;
    title?: string;
    description?: string;
  };
}

export interface FlightStatus {
  type?: string;
  status?: string;
  departure: FlightEndpoint;
  arrival: FlightEndpoint;
  number?: string;
  callSign?: string;
  airline?: {
    name?: string;
    iata?: string;
    icao?: string;
  };
  aircraft?: FlightAircraft;
  location?: {
    pressureAltFt?: number;
    gsKt?: number;
    lat?: number;
    lon?: number;
  };
  codeshareStatus?: string;
  isCargo?: boolean;
  greatCircleDistance?: {
    meter?: number;
    km?: number;
    mile?: number;
  };
}

export type FlightStatusResponse = FlightStatus[];

// --- Airport Flights Board ---

export interface BoardFlight {
  departure: FlightEndpoint;
  arrival: FlightEndpoint;
  number?: string;
  status?: string;
  codeshareStatus?: string;
  isCargo?: boolean;
  airline?: {
    name?: string;
    iata?: string;
    icao?: string;
  };
  aircraft?: {
    model?: string;
    reg?: string;
  };
}

export interface AirportBoardResponse {
  departures?: BoardFlight[];
  arrivals?: BoardFlight[];
}

// --- Flight Delay Statistics ---

export interface FlightDelayStats {
  route?: {
    from?: string;
    to?: string;
  };
  averageDelayMin?: number;
  cancelledPercentage?: number;
  delayDistribution?: Array<{
    bucket?: string;
    percentage?: number;
  }>;
  medianDelayMin?: number;
  onTimePercentage?: number;
  observations?: number;
}

// --- Airport Delay Statistics ---

export interface AirportDelayInfo {
  averageDelayMin?: number;
  delayIndex?: number;
  medianDelayMin?: number;
  cancellations?: number;
  totalFlights?: number;
}

export interface AirportDelayStats {
  airport?: {
    iata?: string;
    name?: string;
  };
  date?: string;
  departures?: AirportDelayInfo;
  arrivals?: AirportDelayInfo;
}

// --- Orders ---

export interface OrderShort {
  orderId: number;
  code: string;
  status: string;
  totalPrice: number;
  currency: string;
  paymentStatus: string;
  createdAt: string | null;
}

export interface OrderList {
  items: OrderShort[];
  total: number;
  offset: number;
  limit: number;
}

export interface OrderPassenger {
  id: number;
  firstName: string;
  lastName: string;
  type: string;
}

export interface OrderService {
  id: number;
  type: string;
  title: string;
  status: string;
  date: string;
  priceGross: number;
  priceNet: number;
  ticketNumber?: string;
  pnr?: string;
}

export interface OrderTicket {
  ticketNumber: string;
  serviceId: number;
  type: string;
  status: string;
}

export interface OrderFull {
  orderId: number;
  code: string;
  status: string;
  totalPrice: number;
  currency: string;
  passengers: OrderPassenger[];
  services: OrderService[];
  tickets?: OrderTicket[];
  paymentStatus: string;
  ticketingDeadline: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CancelCheckRefund {
  estimatedAmount: number;
  penalty: number;
  currency: string;
  type: string;
}

export interface CancelCheckResponse {
  cancellable: boolean;
  refund?: CancelCheckRefund | null;
  deadline?: string | null;
  rules?: string | null;
}

export interface CancelResultRefund {
  amount: number;
  currency: string;
  type: string;
  penalty: number;
}

export interface CancelResult {
  orderId: number;
  status: string;
  cancelledAt: string | null;
  refund?: CancelResultRefund | null;
}

export interface ModifyCheckService {
  serviceId: number;
  title: string;
  allowedChanges: string[];
}

export interface ModifyCheckResponse {
  modifiable: boolean;
  services?: ModifyCheckService[];
}

export interface ModifyResult {
  orderId: number;
  status: string;
}

// --- Hotels ---

export interface HotelLocationChild {
  id: string | number;
  partner: string;
  name: string;
  address: string;
  countryCode: string;
}

export interface HotelLocationGroup {
  type: string; // "region" | "hotel"
  text: string;
  children: HotelLocationChild[];
}

export interface HotelLocationSearchResponse {
  items: HotelLocationGroup[];
  time: number;
}

export interface HotelLocationDetail {
  id: number;
  nameRu: string;
  nameEn: string;
  entityType: string; // "city" | "region" | "hotel"
}

export interface HotelLocationDetailResponse {
  result: HotelLocationDetail;
}

export interface HotelRoomGuests {
  adults: number;
  children?: number;
  childrenAges?: number[];
}

export interface HotelSearchFilter {
  minPrice?: number;
  maxPrice?: number;
  starRating?: number[];
  boards?: string[];
  payments?: string[];
}

export interface HotelOffer {
  id?: number;
  name?: string;
  stars?: number;
  address?: string;
  image?: string;
  price?: number;
  currency?: string;
  board?: string;
  boardName?: string;
  rooms?: number;
  cancellation?: string;
  [key: string]: unknown;
}

export interface HotelSSEConnected {
  status: string;
  cached?: boolean;
}

export interface HotelSSEHotelsBatch {
  batch: number;
  count: number;
  hotels: HotelOffer[];
}

export interface HotelSSESortedBatch {
  count: number;
  total: number;
  chunk: number;
  hotels: HotelOffer[];
}

export interface HotelSSECount {
  batch: number;
  count: number;
  total: number;
}

export interface HotelSSECompleted {
  count: number;
  hotels: HotelOffer[];
  cacheKey: string;
}

// --- Hotel Offers (single hotel detail) ---

export interface HotelOfferPrice {
  currency: string;
  net: number;
  gross: number;
  total: number;
  markup: number;
  nights: number;
  rooms: number;
  nightly: number;
  extra?: number;
  totalWithExtra?: number;
  deposit?: number | null;
}

export interface HotelOfferCancelRule {
  deadline: string;     // "YYYY-MM-DD HH:MM:SS"
  type: string;         // "amount" — currently the only documented type
  value: number;        // penalty amount in the offer's currency
}

export interface HotelOfferCancelPolicy {
  refundable: boolean;
  title: string;
  description?: string;       // HTML — rendered as plain text by formatter
  fullyRefundable: boolean;
  rules?: HotelOfferCancelRule[];
}

export interface HotelOfferRate {
  // The booking identifier. Over the wire the field is named `_offerId`
  // (HotelPageService.php → generateOfferId, format
  // xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx) and HotelRateLookup::find() looks up
  // the rate by exactly this value. Some published docs and older fixtures
  // call it `id` — kept as a fallback alias.
  _offerId?: string;
  id?: string;
  hotelCode?: string;
  boardName: string;
  roomName?: string;
  remarks?: string;
  price: HotelOfferPrice;
  cancelPolicy: HotelOfferCancelPolicy;

  // Legacy / alias fields — present in older API builds, never required.
  partnerId?: number;
  externalId?: string;
  quoteKey?: string;
  rooms?: Array<{ occupancyRefId?: number; code?: string; description?: string }>;
}

export interface HotelOfferRoomGroup {
  content: {
    area?: string | null;
    views?: string | null;
    photos?: string[];
  };
  rates: HotelOfferRate[];
}

export interface HotelPropertyDescription {
  title: string;
  text: string;
}

export interface HotelProperty {
  id?: string;
  gId?: number;
  name: string;
  starRating?: number;
  address?: string;
  heroImage?: string;
  images?: Array<{ url: string }>;
  description?: HotelPropertyDescription[];
  latitude?: number;
  longitude?: number;
}

export interface HotelOffersResponse {
  // Canonical field per the published REST contract.
  sessionId?: string;
  // Legacy aliases kept for tolerance — older deployments / fixtures use them.
  offersKey?: string;
  offerKey?: string;
  cacheKey?: string;
  property: HotelProperty;
  offers: Record<string, HotelOfferRoomGroup>;
  bronevikId?: number;
}

// --- Clients (Tourists) ---

export interface ClientDoc {
  id: number;
  kind: string;            // e.g. "passport_f"
  number: string;
  issuedBy?: string;
  issuedAt?: string;
  expireAt?: string;
}

export interface ClientMembership {
  id: number;
  type: string;            // e.g. "airline_card"
  programId: number;
  number: string;
  isDefault: boolean;
}

export interface ClientShort {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  patronymicName?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  birthDay?: string;       // ISO Y-m-d
  email?: string;
  phone?: string;
  sex?: "male" | "female";
  nationality?: number;    // country id
  country?: string;        // localized country name
}

export interface ClientFull extends ClientShort {
  docs: ClientDoc[];
  memberships: ClientMembership[];
}

// --- Current user ---

/**
 * Numeric role codes from common\models\user\Enums\UserRole.
 * Mirrors what the REST API returns at GET /v1/user/me.
 */
export const USER_ROLE = {
  USER: 0,
  ADMIN: 1,
  DIRECTOR: 2,
  ACCOUNTANT: 3,
  MANAGER: 4,
  SPECIALIST: 5,
  TOP_MANAGER: 6,
  EMPLOYEE: 7,
  DEVELOPER: 8,
  EDITOR: 9,
  TRAVEL_MANAGER: 10,
  ADMIN_ACCOUNTANT: 11,
  OPERATOR: 12,
  EMPLOYEE_TRAVELLER: 13,
} as const;

export type UserRoleCode = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export const USER_ROLE_LABEL: Record<number, string> = {
  0: "user",
  1: "admin",
  2: "director",
  3: "accountant",
  4: "manager",
  5: "specialist",
  6: "top_manager",
  7: "employee",
  8: "developer",
  9: "editor",
  10: "travel_manager",
  11: "admin_accountant",
  12: "operator",
  13: "employee_traveller",
};

export interface CurrentUser {
  id: number;
  role: number;
  roleName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  agencyId?: number;
  [key: string]: unknown;
}

// --- Errors ---

export interface ApiErrorResponse {
  code: number;
  message?: string;
  text?: string;
}
