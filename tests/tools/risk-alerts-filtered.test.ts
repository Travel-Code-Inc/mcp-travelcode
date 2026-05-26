import { describe, it, expect, vi } from "vitest";
import { getConflictsHandler } from "../../src/tools/get-conflicts.js";
import { getAdvisoriesHandler } from "../../src/tools/get-advisories.js";
import type { TravelCodeApiClient } from "../../src/client/api-client.js";
import type { AdvisoriesEnvelope, ConflictsEnvelope } from "../../src/client/types.js";

describe("get_conflicts handler", () => {
  it("forwards filters with country upper-cased and renders events sorted by severity", async () => {
    const resp: ConflictsEnvelope = {
      data: [
        {
          id: 1,
          external_id: "GDELT-1",
          event_code: "190",
          event_root_code: "19",
          country_iso: "UKR",
          location: "Donetsk",
          latitude: 48.0,
          longitude: 37.8,
          description: "Shelling reported in residential area.",
          event_date: "2026-05-25",
          num_mentions: 42,
          severity: "Critical",
          source_url: "https://example.com/1",
        },
        {
          id: 2,
          external_id: "GDELT-2",
          event_code: "180",
          event_root_code: "18",
          country_iso: "UKR",
          location: "Kharkiv",
          latitude: 49.99,
          longitude: 36.23,
          description: "Protest dispersed.",
          event_date: "2026-05-24",
          num_mentions: 8,
          severity: "Medium",
          source_url: "https://example.com/2",
        },
      ],
      total: 2,
      filters: { days: 7, country: "UKR", min_severity: "Medium" },
      attribution: { gdelt: "GDELT Project" },
      fetched_at: "2026-05-26T14:30:00Z",
    };
    const get = vi.fn().mockResolvedValue(resp);
    const client = { get } as unknown as TravelCodeApiClient;

    const result = await getConflictsHandler(client)({
      days: 7,
      country: "ukr",
      min_severity: "Medium",
      limit: 50,
      skip: 0,
    });

    expect(get).toHaveBeenCalledWith("/risk-alerts/conflicts", {
      days: 7,
      country: "UKR",
      min_severity: "Medium",
      limit: 50,
      skip: 0,
    });

    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("2 of 2 conflict events");
    expect(text).toContain("days=7");
    expect(text).toContain("country=UKR");
    expect(text).toContain("Donetsk");
    expect(text).toContain("Kharkiv");
    // Critical should appear before Medium
    expect(text.indexOf("Donetsk")).toBeLessThan(text.indexOf("Kharkiv"));
  });

  it("omits unset filter params", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      filters: { days: null, country: null, min_severity: null },
      attribution: {},
    } as ConflictsEnvelope);
    const client = { get } as unknown as TravelCodeApiClient;

    await getConflictsHandler(client)({});

    expect(get).toHaveBeenCalledWith("/risk-alerts/conflicts", {
      days: undefined,
      country: undefined,
      min_severity: undefined,
      limit: undefined,
      skip: undefined,
    });
  });
});

describe("get_advisories handler", () => {
  it("forwards filters and renders advisories sorted by level desc", async () => {
    const resp: AdvisoriesEnvelope = {
      data: [
        {
          iso_code: "FRA",
          name: "France",
          max_level: 2,
          summary_label: "Exercise increased caution",
          reasons: ["terrorism"],
          sources: [
            { agency: "US", level: 2, summary_label: "L2", url: "https://us.gov", updated_at: null },
          ],
        },
        {
          iso_code: "UKR",
          name: "Ukraine",
          max_level: 4,
          summary_label: "Do not travel",
          reasons: ["armed conflict", "kidnapping"],
          sources: [
            { agency: "US", level: 4, summary_label: "L4", url: "https://us.gov", updated_at: null },
            { agency: "UK", level: 4, summary_label: "L4", url: "https://uk.gov", updated_at: null },
          ],
        },
      ],
      total: 2,
      attribution: { state_gov: "US State Dept" },
      fetched_at: "2026-05-26T14:30:00Z",
    };
    const get = vi.fn().mockResolvedValue(resp);
    const client = { get } as unknown as TravelCodeApiClient;

    const result = await getAdvisoriesHandler(client)({ country: "fra", min_level: 1 });

    expect(get).toHaveBeenCalledWith("/risk-alerts/advisories", {
      country: "FRA",
      min_level: 1,
    });

    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("2 of 2 travel advisories");
    // Ukraine (level 4) sorted before France (level 2)
    expect(text.indexOf("Ukraine")).toBeLessThan(text.indexOf("France"));
    expect(text).toContain("level 4");
    expect(text).toContain("armed conflict, kidnapping");
    expect(text).toContain("US:4, UK:4");
  });

  it("renders empty-state when no advisories", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: [],
        total: 0,
        attribution: {},
      } as AdvisoriesEnvelope),
    } as unknown as TravelCodeApiClient;

    const result = await getAdvisoriesHandler(client)({ min_level: 4 });
    expect((result.content[0] as { text: string }).text).toMatch(/no travel advisories match/i);
  });

  it("returns isError on API failure", async () => {
    const client = {
      get: vi.fn().mockRejectedValue(new Error("rate-limited")),
    } as unknown as TravelCodeApiClient;

    const result = await getAdvisoriesHandler(client)({});
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("rate-limited");
  });
});
