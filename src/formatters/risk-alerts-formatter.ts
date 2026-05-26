import {
  ActiveRiskAlertsResponse,
  AdvisoriesEnvelope,
  AlertsByCountryResponse,
  ConflictEvent,
  ConflictsEnvelope,
  CountryAdvisory,
  CountryAdvisoryEnvelope,
  CountryRiskScoreEnvelope,
  TravelRiskAlert,
} from "../client/types.js";

const SEVERITY_RANK: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

function severityRank(s: string | undefined | null): number {
  if (!s) return 0;
  return SEVERITY_RANK[s] ?? 0;
}

function shortDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : iso;
}

function formatAlert(a: TravelRiskAlert): string {
  const parts: string[] = [`[${a.severity}]`, a.alert_type];
  if (a.country_iso) parts.push(a.country_iso);
  if (a.location) parts.push(a.location);
  const date = shortDate(a.event_date);
  if (date) parts.push(date);
  if (a.source) parts.push(`src:${a.source}`);
  const head = parts.join(" · ");
  const desc = (a.description ?? "").trim();
  return desc ? `${head}\n      ${desc}` : head;
}

export function formatActiveAlerts(resp: ActiveRiskAlertsResponse): string {
  const items = (resp.data ?? []).slice();
  if (items.length === 0) {
    return "No active risk alerts.";
  }
  // Critical/High first, then by event_date desc
  items.sort((a, b) => {
    const ra = severityRank(a.severity);
    const rb = severityRank(b.severity);
    if (rb !== ra) return rb - ra;
    return (b.event_date ?? "").localeCompare(a.event_date ?? "");
  });
  const lines: string[] = [`${items.length} active risk alert${items.length === 1 ? "" : "s"}:`];
  for (const a of items) {
    lines.push(`  - ${formatAlert(a)}`);
  }
  return lines.join("\n");
}

export function formatAlertsByCountry(resp: AlertsByCountryResponse): string {
  const map = resp.data ?? {};
  const countries = Object.keys(map).sort();
  if (countries.length === 0) {
    return "No active risk alerts grouped by country.";
  }
  const totalAlerts = countries.reduce((sum, iso) => sum + (map[iso]?.length ?? 0), 0);
  const lines: string[] = [`${totalAlerts} alerts across ${countries.length} countries:`];
  // Sort countries by alert count desc
  countries.sort((a, b) => (map[b]?.length ?? 0) - (map[a]?.length ?? 0));
  for (const iso of countries) {
    const alerts = map[iso] ?? [];
    const topSeverity = alerts
      .map((a) => a.severity)
      .sort((a, b) => severityRank(b) - severityRank(a))[0];
    lines.push(`  ${iso} · ${alerts.length} alert${alerts.length === 1 ? "" : "s"} · top severity: ${topSeverity ?? "n/a"}`);
  }
  return lines.join("\n");
}

export function formatCountryAdvisory(resp: CountryAdvisoryEnvelope): string {
  const c = resp.data;
  if (!c) {
    return "No advisory data available for this country.";
  }
  const lines: string[] = [`${c.name} (${c.iso_code})`];
  lines.push(`Advisory level: ${c.advisory_level} · risk score: ${c.risk_score}`);
  if (c.advisory_description) lines.push(c.advisory_description);
  const meta: string[] = [];
  const adate = shortDate(c.advisory_date);
  if (adate) meta.push(`advisory date: ${adate}`);
  const upd = shortDate(c.last_updated);
  if (upd) meta.push(`updated: ${upd}`);
  if (meta.length > 0) lines.push(meta.join(" · "));
  return lines.join("\n");
}

export function formatCountryRiskScore(resp: CountryRiskScoreEnvelope): string {
  const s = resp.data;
  if (!s) {
    return "No risk-score data available for this country.";
  }
  const lines: string[] = [`${s.name} (${s.iso_code})`];
  lines.push(`Composite risk score: ${s.risk_score} · advisory level: ${s.advisory_level}`);
  lines.push(`Active alerts: ${s.active_alerts}`);
  const c = s.calculation;
  if (c) {
    lines.push("");
    lines.push("Calculation:");
    lines.push(`  base ${c.base_score} + alert impact ${c.alert_impact} = composite ${c.composite}`);
  }
  return lines.join("\n");
}

function formatConflictRow(e: ConflictEvent): string {
  const parts: string[] = [`[${e.severity}]`];
  if (e.country_iso) parts.push(e.country_iso);
  if (e.location) parts.push(e.location);
  const date = shortDate(e.event_date);
  if (date) parts.push(date);
  if (e.num_mentions > 0) parts.push(`${e.num_mentions} mentions`);
  const head = parts.join(" · ");
  const desc = (e.description ?? "").trim();
  return desc ? `${head}\n      ${desc}` : head;
}

export function formatConflicts(resp: ConflictsEnvelope): string {
  const items = resp.data ?? [];
  if (items.length === 0) {
    return `No conflict events match (total ${resp.total ?? 0}).`;
  }
  const f = resp.filters ?? { days: null, country: null, min_severity: null };
  const filterBits: string[] = [];
  if (f.days) filterBits.push(`days=${f.days}`);
  if (f.country) filterBits.push(`country=${f.country}`);
  if (f.min_severity) filterBits.push(`min_severity=${f.min_severity}`);
  const filterLine = filterBits.length > 0 ? ` (${filterBits.join(", ")})` : "";

  const lines: string[] = [`${items.length} of ${resp.total ?? items.length} conflict events${filterLine}:`];
  // Same Critical/High first sort as alerts
  const sorted = items.slice().sort((a, b) => {
    const ra = severityRank(a.severity);
    const rb = severityRank(b.severity);
    if (rb !== ra) return rb - ra;
    return (b.event_date ?? "").localeCompare(a.event_date ?? "");
  });
  for (const e of sorted) {
    lines.push(`  - ${formatConflictRow(e)}`);
  }
  return lines.join("\n");
}

function formatAdvisoryRow(c: CountryAdvisory): string {
  const lines: string[] = [`${c.name} (${c.iso_code}) · level ${c.max_level} — ${c.summary_label}`];
  if (c.reasons && c.reasons.length > 0) {
    lines.push(`      reasons: ${c.reasons.join(", ")}`);
  }
  if (c.sources && c.sources.length > 0) {
    const srcs = c.sources.map((s) => `${s.agency}:${s.level}`).join(", ");
    lines.push(`      sources: ${srcs}`);
  }
  return lines.join("\n");
}

export function formatAdvisories(resp: AdvisoriesEnvelope): string {
  const items = resp.data ?? [];
  if (items.length === 0) {
    return `No travel advisories match (total ${resp.total ?? 0}).`;
  }
  const sorted = items.slice().sort((a, b) => Number(b.max_level) - Number(a.max_level));
  const lines: string[] = [`${items.length} of ${resp.total ?? items.length} travel advisories (sorted by level desc):`];
  for (const c of sorted) {
    lines.push(`  - ${formatAdvisoryRow(c)}`);
  }
  return lines.join("\n");
}
