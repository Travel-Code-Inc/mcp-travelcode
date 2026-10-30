import { describe, it, expect, vi, afterEach } from "vitest";
import { TravelCodeApiClient, TravelCodeScopeError, sanitizeApiMessage } from "../../src/client/api-client.js";

describe("sanitizeApiMessage", () => {
  it("keeps validation text, drops links, paths, stack traces and raw payloads", () => {
    expect(sanitizeApiMessage("PASSENGER_VALIDATION_ERROR: passengers.0.dateOfBirth must use YYYY-MM-DD or DD.MM.YYYY format"))
      .toBe("PASSENGER_VALIDATION_ERROR: passengers.0.dateOfBirth must use YYYY-MM-DD or DD.MM.YYYY format");
    const raw = [
      "Supplier error: see https://travel.api.amadeus.com/v1/booking/flight-orders/eJz123",
      "#0 /var/www/html/common/services/external/avia/amadeus/Amadeus.php(1109): x()",
      "in /var/www/html/rest/models/Order/Create/Handler.php:574",
      `{"errors":[{"status":400,"code":32171,"title":"MANDATORY DATA MISSING","detail":"${"x".repeat(300)}"}]}`,
    ].join("\n");
    const out = sanitizeApiMessage(raw);
    expect(out).not.toMatch(/amadeus\.com|\/var\/www|\.php|32171/);
    expect(out).toMatch(/\[link\]/);
    expect(out.length).toBeLessThanOrEqual(401);
  });
});

describe("insufficient OAuth scope", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("turns platform error 139 into a reconnect message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ name: "Forbidden", message: "[139] This app was not granted access", code: 139, status: 403 }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    )));
    const client = new TravelCodeApiClient({ apiBaseUrl: "http://api.test", apiToken: "t" } as never);
    await expect(client.post("/orders", {})).rejects.toBeInstanceOf(TravelCodeScopeError);
  });
});
