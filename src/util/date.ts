export class AmbiguousDateError extends Error {
  constructor(
    public readonly input: string,
    public readonly fieldPath: string,
    public readonly hint: string,
  ) {
    super(
      `Ambiguous date "${input}" for ${fieldPath}: ${hint}. Ask the user to confirm the date in YYYY-MM-DD or DD.MM.YYYY format.`,
    );
    this.name = "AmbiguousDateError";
  }
}

export class InvalidDateError extends Error {
  constructor(
    public readonly input: string,
    public readonly fieldPath: string,
  ) {
    super(`Invalid date "${input}" for ${fieldPath}. Expected YYYY-MM-DD.`);
    this.name = "InvalidDateError";
  }
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/;
const DOTTED_RE = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/;
const COMPACT_RE = /^(\d{4})(\d{2})(\d{2})$/;

function isValidYmd(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Normalize a user-supplied date to strict YYYY-MM-DD.
 * Accepts: YYYY-MM-DD, ISO datetime, DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY, YYYYMMDD.
 *
 * Throws AmbiguousDateError when both interpretations are valid (e.g. "03.04.2026"
 * is March 4 in US locale and April 3 in EU locale and we can't tell). The caller
 * should surface the error to the user and re-ask.
 *
 * Throws InvalidDateError on garbage input.
 */
export function normalizeDate(input: string, fieldPath: string): string {
  const raw = (input ?? "").toString().trim();
  if (!raw) throw new InvalidDateError(raw, fieldPath);

  // 1) ISO YYYY-MM-DD or ISO datetime
  const iso = raw.match(ISO_RE);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (!isValidYmd(y, m, d)) throw new InvalidDateError(raw, fieldPath);
    return `${iso[1]}-${pad(m)}-${pad(d)}`;
  }

  // 2) Compact YYYYMMDD
  const compact = raw.match(COMPACT_RE);
  if (compact) {
    const y = Number(compact[1]);
    const m = Number(compact[2]);
    const d = Number(compact[3]);
    if (!isValidYmd(y, m, d)) throw new InvalidDateError(raw, fieldPath);
    return `${compact[1]}-${pad(m)}-${pad(d)}`;
  }

  // 3) Dotted DD.MM.YYYY (or with / or -). Disambiguate vs MM.DD.YYYY:
  //    if first part > 12, must be DD; if second part > 12, must be MM-first;
  //    otherwise ambiguous.
  const dotted = raw.match(DOTTED_RE);
  if (dotted) {
    const a = Number(dotted[1]);
    const b = Number(dotted[2]);
    const y = Number(dotted[3]);
    const dmyValid = isValidYmd(y, b, a); // a=day, b=month
    const mdyValid = isValidYmd(y, a, b); // a=month, b=day

    // Rule: if a > 12, only DMY makes sense. If b > 12, only MDY.
    if (a > 12 && dmyValid) return `${y}-${pad(b)}-${pad(a)}`;
    if (b > 12 && mdyValid) return `${y}-${pad(a)}-${pad(b)}`;

    // Equal day/month → unambiguous (e.g. 05.05.2026).
    if (a === b && dmyValid) return `${y}-${pad(b)}-${pad(a)}`;

    // Both interpretations valid and differ → ambiguous.
    if (dmyValid && mdyValid) {
      throw new AmbiguousDateError(
        raw,
        fieldPath,
        "could be DD.MM.YYYY or MM.DD.YYYY",
      );
    }
    if (dmyValid) return `${y}-${pad(b)}-${pad(a)}`;
    if (mdyValid) return `${y}-${pad(a)}-${pad(b)}`;
    throw new InvalidDateError(raw, fieldPath);
  }

  throw new InvalidDateError(raw, fieldPath);
}
