import { ClientFull, ClientShort } from "../client/types.js";

function fullName(c: ClientShort): string {
  const cyr = [c.lastName, c.firstName, c.patronymicName].filter(Boolean).join(" ");
  const lat = [c.lastNameEn, c.firstNameEn].filter(Boolean).join(" ");
  return lat ? `${cyr} (${lat})` : cyr;
}

function contactLine(c: ClientShort): string {
  const parts: string[] = [];
  if (c.phone) parts.push(c.phone);
  if (c.email) parts.push(c.email);
  return parts.join(" · ");
}

export function formatClientShort(c: ClientShort): string {
  const name = fullName(c);
  const contact = contactLine(c);
  const bits = [`#${c.id} ${name}`];
  if (contact) bits.push(contact);
  return bits.join(" · ");
}

export function formatClientList(cs: ClientShort[]): string {
  if (cs.length === 0) {
    return "No clients found.";
  }
  const lines: string[] = [`${cs.length} client${cs.length === 1 ? "" : "s"} found:`];
  for (const c of cs) {
    lines.push(`  ${formatClientShort(c)}`);
  }
  return lines.join("\n");
}

export function formatClient(c: ClientFull): string {
  const lines: string[] = [];

  lines.push(`Client #${c.id}`);
  lines.push(fullName(c));

  const identity: string[] = [];
  if (c.sex) identity.push(c.sex);
  if (c.birthDay) identity.push(`born ${c.birthDay}`);
  if (c.country) identity.push(c.country);
  if (identity.length > 0) lines.push(identity.join(" · "));

  const contact = contactLine(c);
  if (contact) lines.push(contact);

  if (c.docs && c.docs.length > 0) {
    lines.push("");
    lines.push("Documents:");
    for (const d of c.docs) {
      const parts = [`  - [${d.kind}] ${d.number}`];
      if (d.issuedAt) parts.push(`issued ${d.issuedAt}`);
      if (d.expireAt) parts.push(`expires ${d.expireAt}`);
      if (d.issuedBy) parts.push(d.issuedBy);
      lines.push(parts.join(" · "));
    }
  }

  if (c.memberships && c.memberships.length > 0) {
    lines.push("");
    lines.push("Memberships:");
    for (const m of c.memberships) {
      const def = m.isDefault ? " (default)" : "";
      lines.push(`  - [${m.type}] ${m.number} · program ${m.programId}${def}`);
    }
  }

  return lines.join("\n");
}
