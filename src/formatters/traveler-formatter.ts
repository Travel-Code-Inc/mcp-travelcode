import {
  ContactTravelersResponse,
  TravelerCurrentTrip,
  TravelerFull,
  TravelerShort,
  TravelersListResponse,
  TravelerDetailResponse,
  TravelerTripService,
} from "../client/types.js";

function shortDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : iso;
}

function location(t: TravelerShort): string | undefined {
  const parts: string[] = [];
  if (t.country_iso) parts.push(t.country_iso);
  if (t.city) parts.push(t.city);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

function contactLine(t: TravelerShort): string | undefined {
  const parts: string[] = [];
  if (t.email) parts.push(t.email);
  if (t.phone) parts.push(t.phone);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function tripRange(t: TravelerShort): string | undefined {
  const start = shortDate(t.trip_start);
  const end = shortDate(t.trip_end);
  if (start && end) return `${start} → ${end}`;
  return start || end;
}

export function formatTravelerShort(t: TravelerShort): string {
  const bits: string[] = [`#${t.id}  ${t.name}`];
  if (t.status) bits.push(t.status);
  const loc = location(t);
  if (loc) bits.push(loc);
  const trip = tripRange(t);
  if (trip) bits.push(trip);
  const contact = contactLine(t);
  if (contact) bits.push(contact);
  return bits.join(" · ");
}

export function formatTravelerList(resp: TravelersListResponse): string {
  const items = resp.data ?? [];
  const { offset = 0, limit = 0, total = 0 } = resp.pagination ?? {};
  if (items.length === 0) {
    return `No travelers found (total ${total}).`;
  }
  const header = `${items.length} of ${total} travelers (offset ${offset}, limit ${limit}):`;
  const lines = [header, ...items.map((t) => `  ${formatTravelerShort(t)}`)];
  return lines.join("\n");
}

function formatService(s: TravelerTripService): string {
  const parts: string[] = [s.type];
  if (s.title) parts.push(s.title);
  if (s.date) parts.push(s.date);
  if (s.duration_days != null) parts.push(`${s.duration_days} day${s.duration_days === 1 ? "" : "s"}`);
  const place: string[] = [];
  if (s.city) place.push(s.city);
  if (s.country_iso) place.push(s.country_iso);
  if (place.length > 0) parts.push(place.join(", "));
  return parts.join(" · ");
}

function currentTripBlock(trip: TravelerCurrentTrip): string[] {
  const lines: string[] = ["", "Current trip:"];
  const head: string[] = [];
  if (trip.order_id != null) head.push(`order #${trip.order_id}`);
  if (trip.order_status) head.push(trip.order_status);
  if (head.length > 0) lines.push(`  ${head.join(" · ")}`);
  for (const s of trip.services ?? []) {
    lines.push(`  - ${formatService(s)}`);
  }
  return lines;
}

export function formatTraveler(resp: TravelerDetailResponse): string {
  const t: TravelerFull = resp.data;
  const lines: string[] = [];

  lines.push(`Traveler #${t.id}`);
  lines.push(t.name);

  const identity: string[] = [];
  if (t.role) identity.push(t.role);
  if (t.birth_day) identity.push(`born ${t.birth_day}`);
  if (t.nationality) identity.push(t.nationality);
  if (identity.length > 0) lines.push(identity.join(" · "));

  const loc = location(t);
  if (loc) lines.push(loc);

  const trip = tripRange(t);
  if (trip) lines.push(`Trip: ${trip}${t.status ? ` (${t.status})` : ""}`);

  const contact = contactLine(t);
  if (contact) lines.push(contact);

  if (t.passport_number || t.passport_expire_at) {
    lines.push("");
    lines.push("Document:");
    const doc: string[] = [];
    if (t.passport_number) doc.push(`passport ${t.passport_number}`);
    if (t.passport_expire_at) doc.push(`expires ${t.passport_expire_at}`);
    lines.push(`  ${doc.join(" · ")}`);
  }

  if (t.current_trip) {
    lines.push(...currentTripBlock(t.current_trip));
  }

  return lines.join("\n");
}

export function formatContactResult(resp: ContactTravelersResponse): string {
  const sent = resp.sent ?? [];
  const failed = resp.failed ?? [];
  const lines: string[] = [`Queued: ${sent.length} · Failed: ${failed.length}`];

  if (sent.length > 0) {
    lines.push("");
    lines.push("Sent:");
    for (const s of sent) {
      lines.push(`  - #${s.id} via ${s.channel} → ${s.status}`);
    }
  }

  if (failed.length > 0) {
    lines.push("");
    lines.push("Failed:");
    for (const f of failed) {
      lines.push(`  - #${f.id} → ${f.reason}`);
    }
  }

  return lines.join("\n");
}
