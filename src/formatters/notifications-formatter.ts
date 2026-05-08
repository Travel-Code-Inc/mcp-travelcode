import {
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
