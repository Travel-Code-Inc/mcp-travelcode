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
  id?: number;
  firstName?: string;
  lastName?: string;
  type?: string;
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

/**
 * Order shape per the published REST contract for POST /v1/orders and
 * GET /v1/orders/{id}. Some fields are tolerated under multiple names
 * because earlier internal builds emitted slightly different keys.
 */
export interface OrderFull {
  // Canonical fields per the Travel Code REST API (§9.1):
  //   id, code, status, currency, priceGross, payPrice, paid,
  //   tourBegin, tourEnd, services[], clients[].
  id?: number;
  code?: string;
  status?: string;
  currency?: string;
  priceGross?: number;  // total agency-side price
  payPrice?: number;    // amount the buyer is charged now
  paid?: number;        // amount already received
  tourBegin?: string;
  tourEnd?: string;
  services?: OrderService[];
  clients?: OrderPassenger[];

  // Legacy / alias fields — earlier builds used `price`, `orderId`,
  // `totalPrice`, `passengers`. Kept tolerant so older fixtures still render.
  price?: number;
  orderId?: number;
  totalPrice?: number;
  passengers?: OrderPassenger[];
  tickets?: OrderTicket[];
  paymentStatus?: string;
  ticketingDeadline?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  viewUrl?: string | null;
}

/** POST /v1/orders wraps the order in `{ order: ... }`. */
export interface OrderEnvelope {
  order: OrderFull;
}

/** Per-service breakdown returned by GET /v1/orders/{id}/cancel/check (§9.4). */
export interface CancelCheckDetail {
  serviceId: number;
  type: string;       // "hotel", "flight", ...
  title: string;
  refundable: boolean;
  deadline?: string | null;
  penalty?: number;
}

/** Legacy nested refund — earlier internal builds returned this shape. */
export interface CancelCheckRefund {
  estimatedAmount?: number;
  penalty?: number;
  currency?: string;
  type?: string;
}

export interface CancelCheckResponse {
  cancellable: boolean;

  // Canonical (Travel Code REST §9.4): flat fields + per-service details[].
  refundAmount?: number;
  penaltyAmount?: number;
  currency?: string;
  details?: CancelCheckDetail[];

  // Legacy / alias fields kept tolerant so older fixtures still render.
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
  hotelUrl?: string;
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

// --- Risk Alerts (duty-of-care, proxied from TravelRiskAPI) ---

export type RiskAlertSeverity = "Critical" | "High" | "Medium" | "Low" | string;
export type RiskAlertSource = "gdacs" | "usgs" | "eonet" | "nws" | "reliefweb" | null;

export interface TravelRiskAlert {
  id: number;
  alert_type: string;
  severity: RiskAlertSeverity;
  country_iso: string | null;
  location: string;
  latitude: number;
  longitude: number;
  description: string;
  event_date: string;
  created_at: string;
  source: RiskAlertSource;
  external_id: string | null;
  polygon: Array<[number, number]> | null;
}

export interface ActiveRiskAlertsResponse {
  data: TravelRiskAlert[];
  fetched_at?: string;
}

export type AlertsByCountryMap = Record<string, TravelRiskAlert[]>;

export interface AlertsByCountryResponse {
  data: AlertsByCountryMap;
  fetched_at?: string;
}

export interface TravelRiskCountry {
  iso_code: string;
  name: string;
  advisory_level: number;
  advisory_description: string;
  advisory_date: string;
  risk_score: number;
  last_updated: string;
}

export interface CountryAdvisoryEnvelope {
  data: TravelRiskCountry | null;
  fetched_at?: string;
}

export interface TravelRiskScore {
  iso_code: string;
  name: string;
  risk_score: number;
  advisory_level: number;
  active_alerts: number;
  calculation: {
    base_score: number;
    alert_impact: number;
    composite: number;
  };
}

export interface CountryRiskScoreEnvelope {
  data: TravelRiskScore | null;
  fetched_at?: string;
}

export type ConflictRootCode = "17" | "18" | "19" | "20" | string;

export interface ConflictEvent {
  id: number;
  external_id: string;
  event_code: string;
  event_root_code: ConflictRootCode;
  country_iso: string | null;
  location: string;
  latitude: number;
  longitude: number;
  description: string;
  event_date: string;
  num_mentions: number;
  severity: "Critical" | "High" | "Medium" | string;
  source_url: string;
}

export interface ConflictsEnvelope {
  data: ConflictEvent[];
  total: number;
  filters: {
    days: number | null;
    country: string | null;
    min_severity: string | null;
  };
  attribution: Record<string, string>;
  fetched_at?: string;
}

export type AdvisoryLevel = 1 | 2 | 3 | 4 | number;
export type AdvisoryAgency = "US" | "UK" | "CA" | string;

export interface AdvisorySource {
  agency: AdvisoryAgency;
  level: AdvisoryLevel;
  summary_label: string;
  url: string | null;
  updated_at: string | null;
}

export interface CountryAdvisory {
  iso_code: string;
  name: string;
  max_level: AdvisoryLevel;
  summary_label: string;
  reasons: string[];
  sources: AdvisorySource[];
}

export interface AdvisoriesEnvelope {
  data: CountryAdvisory[];
  total: number;
  attribution: Record<string, string>;
  fetched_at?: string;
}

// --- Travelers (duty-of-care) ---

export type TravelerTripStatus = "departing" | "enroute" | "returning";

export interface TravelerShort {
  id: string;                 // public format: "oc-<int>"
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  initials?: string;
  city?: string;
  country_iso?: string;       // ISO 3166-1 alpha-3
  latitude?: number;
  longitude?: number;
  trip_start?: string;        // ISO 8601
  trip_end?: string;          // ISO 8601
  status?: TravelerTripStatus;
}

export interface TravelerTripService {
  type: string;               // "hotel" | "flight" | ...
  title?: string;
  date?: string;              // YYYY-MM-DD
  duration_days?: number | null;
  country_iso?: string;
  city?: string;
}

export interface TravelerCurrentTrip {
  order_id?: number;
  order_status?: string;
  services?: TravelerTripService[];
}

export interface TravelerFull extends TravelerShort {
  passport_number?: string;
  passport_expire_at?: string;
  birth_day?: string;
  nationality?: string;       // ISO 3166-1 alpha-3
  current_trip?: TravelerCurrentTrip;
}

export interface TravelersPagination {
  offset: number;
  limit: number;
  total: number;
}

export interface TravelersListResponse {
  data: TravelerShort[];
  pagination: TravelersPagination;
  fetched_at?: string;
}

export interface TravelerDetailResponse {
  data: TravelerFull;
  fetched_at?: string;
}

export type TravelerContactChannel = "email" | "sms" | "push";
export type TravelerContactTemplate = "safety_check_in" | "evacuation_advisory" | "custom";

export interface ContactTravelersRequest {
  traveler_ids: string[];
  channel: TravelerContactChannel;
  template: TravelerContactTemplate;
  custom_message?: string;
}

export interface ContactSentItem {
  id: string;
  channel: TravelerContactChannel;
  status: string;             // e.g. "queued"
}

export interface ContactFailedItem {
  id: string;
  reason: string;
}

export interface ContactTravelersResponse {
  sent: ContactSentItem[];
  failed: ContactFailedItem[];
  fetched_at?: string;
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

// --- Notifications ---

export type NotificationChannel = "email" | "telegram" | "slack";

export type NotificationStatus = "connected" | "inactive" | "not_connected";

export interface NotificationIntegration {
  channel: NotificationChannel;
  title: string;
  active: boolean;
  connected: boolean;
  status: NotificationStatus;
  settings: Record<string, unknown> | unknown[];
}

export interface NotificationIntegrationsResponse {
  items: NotificationIntegration[];
}

export interface TelegramStatus {
  connected: boolean;
  username: string | null;
  chatId: string | null;
}

export interface SlackStatus {
  connected: boolean;
  teamName: string | null;
  teamId: string | null;
}

export interface SlackInstallUrlResponse {
  url: string;
  expiresAt: number;
}

export interface TelegramInitResponse {
  url: string;
  nonce: string;
  expiresAt: number;
}

export interface NotificationSettingItem {
  id: number;
  typeCode: string;
  title: string;
  description: string | null;
  groupCode: string;
  groupTitle: string;
  value: boolean;
  available: boolean;
}

export interface NotificationSettingsList {
  channel: NotificationChannel;
  active: boolean;
  connected: boolean;
  items: NotificationSettingItem[];
}

export interface NotificationSettingDetail extends NotificationSettingItem {
  channel: NotificationChannel;
  channelActive: boolean;
  connected: boolean;
}

export interface NotificationUpdateResponse {
  success: boolean;
  channel: NotificationChannel;
  typeCode: string;
  value: boolean;
}

export interface NotificationToggleResponse {
  success: boolean;
  active: boolean;
}

// --- Email BCC (per-group BCC for the email channel) ---

export type EmailBccStatus = "pending" | "confirmed";

export interface EmailBccAddress {
  id: number;
  email: string;
  status: EmailBccStatus;
  confirmedAt: number | null;
  createdAt: number;
  canRequestConfirmation: boolean;
  nextRequestAvailableAt: number | null;
  tokenExpiresAt: number | null;
}

export interface EmailBccGroup {
  groupCode: string;
  groupTitle: string;
  addresses: EmailBccAddress[];
}

export interface EmailBccListResponse {
  limit: number;
  groups: EmailBccGroup[];
}

export interface EmailBccMutationResponse {
  success: boolean;
  groupCode: string;
  address: EmailBccAddress;
}

export interface EmailBccDeleteResponse {
  success: boolean;
}

// --- Rate Guard (agency settings) ---

export interface RateGuardDefaults {
  enabled: boolean;
  savingPercent: number;
  savingAmountUsd: number;
  maxEarlierCancelShiftDays: number;
  minDaysBeforeCheckin: number;
}

export interface RateGuardSettings extends RateGuardDefaults {
  defaults: RateGuardDefaults;
  updatedAt: number | null;
  updatedBy: number | null;
}

// --- Errors ---

/**
 * Canonical error envelope per the Travel Code REST API:
 *   { "error": { "code": "OFFER_EXPIRED", "message": "...", "details": ... } }
 *
 * Older builds returned a flat shape with a numeric code or a `text` field —
 * both are tolerated when extracting a human-readable message.
 */
export interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export interface ApiErrorResponse extends ApiErrorEnvelope {
  // Legacy / flat aliases
  code?: number | string;
  message?: string;
  text?: string;
  // Field-validation shape: { errors: { field: ["msg"] } }
  errors?: Record<string, string[] | string>;
}
