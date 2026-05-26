import { describe, it, expect, vi } from "vitest";
import { getActiveRiskAlertsHandler } from "../../src/tools/get-active-risk-alerts.js";
import { getRiskAlertsByCountryHandler } from "../../src/tools/get-risk-alerts-by-country.js";
import type { TravelCodeApiClient } from "../../src/client/api-client.js";
import type {
  ActiveRiskAlertsResponse,
  AlertsByCountryResponse,
} from "../../src/client/types.js";

const sampleActive: ActiveRiskAlertsResponse = {
  data: [
    {
      id: 1,
      alert_type: "earthquake",
      severity: "Medium",
      country_iso: "TUR",
      location: "Anatolia",
      latitude: 38.5,
      longitude: 35.0,
      description: "Magnitude 5.2 felt across central region.",
      event_date: "2026-05-20T10:00:00Z",
      created_at: "2026-05-20T10:05:00Z",
      source: "usgs",
      external_id: "us6000abc",
      polygon: null,
    },
    {
      id: 2,
      alert_type: "flood",
      severity: "Critical",
      country_iso: "PAK",
      location: "Sindh",
      latitude: 25.0,
      longitude: 68.0,
      description: "Major flooding displaced thousands.",
      event_date: "2026-05-25T00:00:00Z",
      created_at: "2026-05-25T01:00:00Z",
      source: "gdacs",
      external_id: "FL-2026-001",
      polygon: null,
    },
  ],
  fetched_at: "2026-05-26T14:30:00Z",
};

describe("get_active_risk_alerts handler", () => {
  it("hits /risk-alerts/active and renders alerts sorted by severity desc", async () => {
    const get = vi.fn().mockResolvedValue(sampleActive);
    const client = { get } as unknown as TravelCodeApiClient;
    const handler = getActiveRiskAlertsHandler(client);

    const result = await handler();

    expect(get).toHaveBeenCalledWith("/risk-alerts/active");
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("2 active risk alerts");
    // Critical (PAK flood) should come before Medium (TUR earthquake)
    const pakIdx = text.indexOf("PAK");
    const turIdx = text.indexOf("TUR");
    expect(pakIdx).toBeGreaterThan(-1);
    expect(turIdx).toBeGreaterThan(pakIdx);
    expect(text).toContain("earthquake");
    expect(text).toContain("flood");
    expect(result.isError).toBeUndefined();
  });

  it("returns the empty-state message when there are no alerts", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ data: [] } as ActiveRiskAlertsResponse),
    } as unknown as TravelCodeApiClient;

    const result = await getActiveRiskAlertsHandler(client)();
    expect((result.content[0] as { text: string }).text).toMatch(/no active risk alerts/i);
  });

  it("returns isError when the API throws", async () => {
    const client = {
      get: vi.fn().mockRejectedValue(new Error("upstream 503")),
    } as unknown as TravelCodeApiClient;

    const result = await getActiveRiskAlertsHandler(client)();
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("upstream 503");
  });
});

describe("get_risk_alerts_by_country handler", () => {
  it("hits /risk-alerts/by-country and renders country counts sorted desc", async () => {
    const grouped: AlertsByCountryResponse = {
      data: {
        TUR: [sampleActive.data[0]],
        PAK: [sampleActive.data[1], { ...sampleActive.data[1], id: 3 }],
      },
      fetched_at: "2026-05-26T14:30:00Z",
    };
    const get = vi.fn().mockResolvedValue(grouped);
    const client = { get } as unknown as TravelCodeApiClient;

    const result = await getRiskAlertsByCountryHandler(client)();

    expect(get).toHaveBeenCalledWith("/risk-alerts/by-country");
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("3 alerts across 2 countries");
    // PAK has 2 alerts, should come first
    const pakIdx = text.indexOf("PAK");
    const turIdx = text.indexOf("TUR");
    expect(pakIdx).toBeLessThan(turIdx);
    expect(text).toContain("top severity: Critical");
  });

  it("renders empty state when grouped map is empty", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ data: {} } as AlertsByCountryResponse),
    } as unknown as TravelCodeApiClient;

    const result = await getRiskAlertsByCountryHandler(client)();
    expect((result.content[0] as { text: string }).text).toMatch(/no active risk alerts grouped by country/i);
  });
});
