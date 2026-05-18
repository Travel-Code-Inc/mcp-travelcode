import {
  EmailBccAddress,
  EmailBccListResponse,
  EmailBccMutationResponse,
  NotificationChannel,
  NotificationIntegration,
  NotificationIntegrationsResponse,
  NotificationSettingDetail,
  NotificationSettingItem,
  NotificationSettingsList,
  NotificationStatus,
  NotificationUpdateResponse,
  SlackInstallUrlResponse,
  SlackStatus,
  TelegramInitResponse,
  TelegramStatus,
} from "../client/types.js";

function statusLabel(s: NotificationStatus): string {
  if (s === "connected") return "connected";
  if (s === "inactive") return "set up but turned off";
  return "not connected";
}

function humanIntegrationDetail(it: NotificationIntegration): string {
  const s = it.settings;
  if (Array.isArray(s) || !s) return "";
  if (it.channel === "telegram") {
    const username = (s as { username?: unknown }).username;
    return typeof username === "string" && username ? `as @${username}` : "";
  }
  if (it.channel === "slack") {
    const team = (s as { teamName?: unknown }).teamName;
    return typeof team === "string" && team ? `in ${team}` : "";
  }
  return "";
}

export function formatIntegrationsList(data: NotificationIntegrationsResponse): string {
  const items = data.items ?? [];
  if (items.length === 0) return "No notification channels available.";

  const lines: string[] = [`${items.length} notification channel${items.length === 1 ? "" : "s"}:`];
  for (const it of items) {
    const head = `  - ${it.title}: ${statusLabel(it.status)}`;
    const detail = humanIntegrationDetail(it);
    lines.push(detail ? `${head} · ${detail}` : head);
  }
  return lines.join("\n");
}

export function formatTelegramStatus(s: TelegramStatus): string {
  if (!s.connected) return "Telegram: not connected.";
  return s.username ? `Telegram: connected as @${s.username}` : "Telegram: connected";
}

export function formatSlackStatus(s: SlackStatus): string {
  if (!s.connected) return "Slack: not connected.";
  return s.teamName ? `Slack: connected in ${s.teamName}` : "Slack: connected";
}

export function formatSlackInstallUrl(r: SlackInstallUrlResponse): string {
  const lines = [
    "Slack install link (open in a browser to authorize, link expires in ~10 minutes):",
    r.url,
  ];
  if (r.expiresAt) {
    lines.push(`expiresAt: ${new Date(r.expiresAt * 1000).toISOString()}`);
  }
  return lines.join("\n");
}

export function formatTelegramInit(r: TelegramInitResponse): string {
  const lines = [
    "Telegram link — open this URL and press Start in Telegram (link is single-use):",
    r.url,
  ];
  if (r.expiresAt) {
    lines.push(`expiresAt: ${new Date(r.expiresAt * 1000).toISOString()}`);
  }
  lines.push("After the user presses Start, poll get_telegram_status until connected.");
  return lines.join("\n");
}

function formatSettingItem(it: NotificationSettingItem): string {
  const flag = it.value ? "on" : "off";
  const avail = it.available ? "" : " (unavailable)";
  return `  - [${flag}] ${it.title} (${it.typeCode})${avail}`;
}

export function formatSettingsList(data: NotificationSettingsList): string {
  const items = data.items ?? [];
  const head = `Notification settings for ${data.channel} — ${
    data.connected ? (data.active ? "connected" : "set up but turned off") : "not connected"
  }:`;
  if (items.length === 0) return `${head}\n  (no settings)`;

  const groups = new Map<string, { title: string; items: NotificationSettingItem[] }>();
  for (const it of items) {
    const key = it.groupCode || "_";
    const g = groups.get(key) ?? { title: it.groupTitle || it.groupCode || "", items: [] };
    g.items.push(it);
    groups.set(key, g);
  }

  const lines: string[] = [head];
  for (const g of groups.values()) {
    lines.push("");
    lines.push(g.title);
    for (const it of g.items) lines.push(formatSettingItem(it));
  }
  return lines.join("\n");
}

export function formatSettingDetail(d: NotificationSettingDetail): string {
  const lines = [
    `${d.title} (${d.typeCode}) on ${d.channel}: ${d.value ? "on" : "off"}`,
  ];
  if (d.groupTitle) lines.push(`group: ${d.groupTitle}`);
  if (d.description) lines.push(d.description);
  lines.push(
    `channel state: ${d.connected ? (d.channelActive ? "connected" : "set up but turned off") : "not connected"}`,
  );
  if (!d.available) lines.push("(this setting is currently unavailable for this channel)");
  return lines.join("\n");
}

export function formatSettingUpdate(r: NotificationUpdateResponse): string {
  return `Updated ${r.typeCode} on ${r.channel}: ${r.value ? "on" : "off"}.`;
}

function channelTitle(c: NotificationChannel): string {
  if (c === "telegram") return "Telegram";
  if (c === "slack") return "Slack";
  return "Email";
}

export function formatActivate(channel: NotificationChannel): string {
  return `${channelTitle(channel)} activated.`;
}

export function formatDisconnect(channel: NotificationChannel): string {
  return `${channelTitle(channel)} disconnected. Credentials cleared.`;
}

function formatUnixTime(ts: number | null | undefined): string {
  if (!ts) return "";
  return new Date(ts * 1000).toISOString();
}

function formatBccAddress(a: EmailBccAddress): string {
  const parts: string[] = [`    - ${a.email} [${a.status}] (id: ${a.id})`];
  if (a.status === "confirmed" && a.confirmedAt) {
    parts.push(`      confirmed at ${formatUnixTime(a.confirmedAt)}`);
  }
  if (a.status === "pending") {
    if (a.canRequestConfirmation) {
      parts.push("      can request confirmation now");
    } else if (a.nextRequestAvailableAt) {
      parts.push(
        `      cannot request confirmation yet — next available at ${formatUnixTime(a.nextRequestAvailableAt)}`,
      );
    } else {
      parts.push("      awaiting confirmation");
    }
    if (a.tokenExpiresAt) {
      parts.push(`      confirmation link valid until ${formatUnixTime(a.tokenExpiresAt)}`);
    } else {
      parts.push("      no valid confirmation link right now");
    }
  }
  return parts.join("\n");
}

export function formatBccList(data: EmailBccListResponse): string {
  const groups = data.groups ?? [];
  if (groups.length === 0) {
    return "No notification groups available for BCC.";
  }
  const lines: string[] = [
    `Email BCC addresses (per-group, max ${data.limit} per group):`,
  ];
  for (const g of groups) {
    lines.push("");
    lines.push(`  ${g.groupTitle} (${g.groupCode}) — ${g.addresses.length}/${data.limit}`);
    if (g.addresses.length === 0) {
      lines.push("    (no BCC addresses)");
      continue;
    }
    for (const a of g.addresses) {
      lines.push(formatBccAddress(a));
    }
  }
  return lines.join("\n");
}

export function formatBccAdd(r: EmailBccMutationResponse): string {
  const a = r.address;
  return [
    `Added ${a.email} to BCC for group "${r.groupCode}" (id: ${a.id}, status: ${a.status}).`,
    "No confirmation email has been sent yet — call send_notification_email_bcc_confirmation to email a verification link.",
    "BCC addresses only start receiving copies after the owner clicks the link in that email.",
  ].join("\n");
}

export function formatBccSendConfirmation(r: EmailBccMutationResponse): string {
  const a = r.address;
  const lines = [
    `Confirmation email queued for ${a.email} (group "${r.groupCode}", id: ${a.id}).`,
    "The owner of that mailbox must open the email and click 'Confirm' for the address to start receiving BCC copies.",
  ];
  if (a.tokenExpiresAt) {
    lines.push(`Confirmation link is valid until ${formatUnixTime(a.tokenExpiresAt)}.`);
  }
  if (a.nextRequestAvailableAt) {
    lines.push(
      `Re-sending another confirmation is rate-limited — next available at ${formatUnixTime(a.nextRequestAvailableAt)}.`,
    );
  }
  return lines.join("\n");
}

export function formatBccDelete(groupCode: string, bccId: number): string {
  return `Removed BCC address #${bccId} from group "${groupCode}". Any pending confirmation link for it is now invalid.`;
}
