import { RateGuardSettings } from "../client/types.js";

export function formatRateGuardSettings(s: RateGuardSettings): string {
  const lines: string[] = [];
  lines.push(`Rate Guard: ${s.enabled ? "enabled" : "disabled"}`);
  lines.push("");
  lines.push("Effective thresholds (effective / default):");
  lines.push(`  - Min savings, percent:       ${s.savingPercent} / ${s.defaults.savingPercent}`);
  lines.push(`  - Min savings, USD:           ${s.savingAmountUsd} / ${s.defaults.savingAmountUsd}`);
  lines.push(`  - Cancel-deadline shift, days:${s.maxEarlierCancelShiftDays} / ${s.defaults.maxEarlierCancelShiftDays}`);
  lines.push(`  - Min days before check-in:   ${s.minDaysBeforeCheckin} / ${s.defaults.minDaysBeforeCheckin}`);
  lines.push("");

  if (s.updatedAt === null) {
    lines.push("Status: no row stored yet — defaults are being used.");
  } else {
    const when = new Date(s.updatedAt * 1000).toISOString().replace("T", " ").slice(0, 19);
    lines.push(`Last update: ${when} UTC by user #${s.updatedBy ?? "?"}`);
  }

  return lines.join("\n");
}
