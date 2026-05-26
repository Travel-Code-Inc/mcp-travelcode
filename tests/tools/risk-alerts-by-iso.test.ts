import { describe, it, expect, vi } from "vitest";
import { getCountryAdvisoryHandler } from "../../src/tools/get-country-advisory.js";
import { getCountryRiskScoreHandler } from "../../src/tools/get-country-risk-score.js";
import type { TravelCodeApiClient } from "../../src/client/api-client.js";
import type {
  CountryAdvisoryEnvelope,
  CountryRiskScoreEnvelope,
} from "../../src/client/types.js";

describe("get_country_advisory handler", () => {
  it("upper-cases ISO and renders the advisory card", async () => {
    const resp: CountryAdvisoryEnvelope = {
      data: {
        iso_code: "UKR",
        name: "Ukraine",
        advisory_level: 4,
        advisory_description: "Do not travel due to armed conflict.",
        advisory_date: "2026-05-01",
        risk_score: 92,
        last_updated: "2026-05-20T12:00:00Z",
      },
      fetched_at: "2026-05-26T14:30:00Z",
    };
    const get = vi.fn().mockResolvedValue(resp);
    const client = { get } as unknown as TravelCodeApiClient;

    const result = await getCountryAdvisoryHandler(client)({ iso: "ukr" });

    expect(get).toHaveBeenCalledWith("/risk-alerts/country/UKR");
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Ukraine (UKR)");
    expect(text).toContain("Advisory level: 4");
    expect(text).toContain("risk score: 92");
    expect(text).toContain("Do not travel");
    expect(text).toContain("advisory date: 2026-05-01");
  });

  it("renders 'no advisory data' when backend returns data:null", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ data: null } as CountryAdvisoryEnvelope),
    } as unknown as TravelCodeApiClient;

    const result = await getCountryAdvisoryHandler(client)({ iso: "ATA" });
    expect((result.content[0] as { text: string }).text).toMatch(/no advisory data available/i);
    expect(result.isError).toBeUndefined();
  });

  it("returns isError when the API throws", async () => {
    const client = {
      get: vi.fn().mockRejectedValue(new Error("net fail")),
    } as unknown as TravelCodeApiClient;

    const result = await getCountryAdvisoryHandler(client)({ iso: "RUS" });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("net fail");
    expect((result.content[0] as { text: string }).text).toContain("RUS");
  });
});

describe("get_country_risk_score handler", () => {
  it("upper-cases ISO and renders the score breakdown", async () => {
    const resp: CountryRiskScoreEnvelope = {
      data: {
        iso_code: "UKR",
        name: "Ukraine",
        risk_score: 88,
        advisory_level: 4,
        active_alerts: 12,
        calculation: { base_score: 60, alert_impact: 28, composite: 88 },
      },
      fetched_at: "2026-05-26T14:30:00Z",
    };
    const get = vi.fn().mockResolvedValue(resp);
    const client = { get } as unknown as TravelCodeApiClient;

    const result = await getCountryRiskScoreHandler(client)({ iso: "ukr" });

    expect(get).toHaveBeenCalledWith("/risk-alerts/risk-score/UKR");
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Ukraine (UKR)");
    expect(text).toContain("Composite risk score: 88");
    expect(text).toContain("base 60 + alert impact 28 = composite 88");
    expect(text).toContain("Active alerts: 12");
  });

  it("renders 'no risk-score data' on data:null (USA-by-design case)", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ data: null } as CountryRiskScoreEnvelope),
    } as unknown as TravelCodeApiClient;

    const result = await getCountryRiskScoreHandler(client)({ iso: "USA" });
    expect((result.content[0] as { text: string }).text).toMatch(/no risk-score data available/i);
  });
});
