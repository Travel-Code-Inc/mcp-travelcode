import { TravelCodeConfig } from "../config.js";
import { getValidToken } from "../auth/token-store.js";
import { ApiErrorResponse } from "./types.js";

export class TravelCodeAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TravelCodeAuthError";
  }
}

export class TravelCodeNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TravelCodeNotFoundError";
  }
}

export class TravelCodeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TravelCodeValidationError";
  }
}

export class TravelCodeServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TravelCodeServerError";
  }
}

export interface OfferChangedDetails {
  type: "offer_changed";
  reason?: string;
  bookKey: string;
  expiresAt?: number;
  previous?: unknown;
  current?: unknown;
}

export class TravelCodeOfferChangedError extends Error {
  public readonly details: OfferChangedDetails;
  constructor(details: OfferChangedDetails) {
    super(`Offer changed (${details.reason ?? "unknown reason"}); confirm with user and retry with bookKey.`);
    this.name = "TravelCodeOfferChangedError";
    this.details = details;
  }
}

function formatFieldErrors(errors: unknown): string {
  if (!errors || typeof errors !== "object") return "";
  const parts: string[] = [];
  for (const [field, messages] of Object.entries(errors as Record<string, unknown>)) {
    const list = Array.isArray(messages) ? messages : [messages];
    const text = list.filter((m) => typeof m === "string" && m.length > 0).join("; ");
    if (text) parts.push(`${field}: ${text}`);
  }
  return parts.join(" | ");
}

export class TravelCodeApiClient {
  private baseUrl: string;
  private token: string;
  private issuer: string;

  constructor(config: TravelCodeConfig) {
    this.baseUrl = config.apiBaseUrl;
    this.token = config.apiToken;
    this.issuer = config.oauthIssuer ?? "";
  }

  /**
   * Ensures the token is still valid, refreshing via OAuth if needed.
   * Falls back to the current token if refresh is not available.
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.issuer) return; // static token, no refresh
    const freshToken = await getValidToken(this.issuer);
    if (freshToken) {
      this.token = freshToken;
    }
  }

  /**
   * Replace the current bearer token. Used by the HTTP transport on every
   * incoming /mcp request, since Claude.ai refreshes its access token in the
   * background and sends a fresh Authorization header on each call.
   */
  setToken(token: string): void {
    this.token = token;
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  async get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    await this.ensureValidToken();
    const response = await fetch(this.buildUrl(path, params), {
      method: "GET",
      headers: this.headers(),
    });
    return this.handleResponse<T>(response);
  }

  async post<T>(
    path: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined>,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    await this.ensureValidToken();
    const response = await fetch(this.buildUrl(path, params), {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async patch<T>(
    path: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    await this.ensureValidToken();
    const response = await fetch(this.buildUrl(path, params), {
      method: "PATCH",
      headers: {
        ...this.headers(),
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    await this.ensureValidToken();
    const response = await fetch(this.buildUrl(path, params), {
      method: "DELETE",
      headers: this.headers(),
    });
    return this.handleResponse<T>(response);
  }

  async getFlightStats<T>(
    subPath: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    await this.ensureValidToken();
    // Build the inner path with query params
    const pathUrl = new URL(`https://placeholder${subPath}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          pathUrl.searchParams.set(key, String(value));
        }
      }
    }
    const fullPath = pathUrl.pathname + pathUrl.search;

    // Route through the TravelCode flight stats proxy endpoint
    const proxyUrl = new URL(`${this.baseUrl}/flight/aerostats`);
    proxyUrl.searchParams.set("path", fullPath);

    const response = await fetch(proxyUrl.toString(), {
      method: "GET",
      headers: this.headers(),
    });

    return this.handleResponse<T>(response);
  }

  /**
   * POST request that returns an SSE stream.
   * Collects events and returns them as an array of {event, data} objects.
   */
  async postSSE(
    path: string,
    body: Record<string, unknown>,
    timeoutMs: number = 130_000
  ): Promise<Array<{ event: string; data: unknown }>> {
    await this.ensureValidToken();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          ...this.headers(),
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMessage: string;
        try {
          const errorBody = (await response.json()) as ApiErrorResponse;
          errorMessage = errorBody.message || errorBody.text || `HTTP ${response.status}`;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        if (response.status === 401) throw new TravelCodeAuthError(errorMessage);
        if (response.status === 404) throw new TravelCodeNotFoundError(errorMessage);
        if (response.status >= 500) throw new TravelCodeServerError(errorMessage);
        throw new Error(`API error: ${errorMessage}`);
      }

      if (!response.body) {
        throw new Error("No response body for SSE stream");
      }

      const events: Array<{ event: string; data: unknown }> = [];
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const raw = line.slice(6);
            try {
              const data = JSON.parse(raw);
              events.push({ event: currentEvent, data });

              // Stop reading after terminal events
              if (currentEvent === "completed" || currentEvent === "error" || currentEvent === "timeout") {
                reader.cancel();
                return events;
              }
            } catch {
              // skip malformed JSON lines
            }
          }
        }
      }

      return events;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * GET for hotel location endpoints. Historically passed the token as an
   * `accessToken` query param; upstream now requires Bearer header, so this
   * is effectively a wrapper around `get` kept under the old name to avoid
   * touching every tool file.
   */
  async getWithTokenParam<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.get<T>(path, params);
  }

  /**
   * POST for hotel offers endpoint. Same story as `getWithTokenParam` — token
   * used to go in the body, now goes in the Authorization header.
   */
  async postWithTokenParam<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return this.post<T>(path, body);
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "X-Source": "mcp-server",
      Accept: "application/json",
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.ok) {
      return (await response.json()) as T;
    }

    let parsedBody: unknown;
    let errorMessage: string;
    try {
      parsedBody = await response.json();
      const errorBody = parsedBody as ApiErrorResponse;
      // Canonical envelope: { error: { code, message, details } }.
      // Legacy flat shape: { code, message } or { text }.
      // Field validation shape: { errors: { fieldA: ["msg"], fieldB: ["msg"] } }.
      const enveloped = errorBody.error;
      const codeStr =
        (enveloped && typeof enveloped.code === "string" && enveloped.code) ||
        (typeof errorBody.code === "string" && errorBody.code) ||
        "";
      const fieldErrors = formatFieldErrors(errorBody.errors);
      const message =
        (enveloped && enveloped.message) ||
        errorBody.message ||
        errorBody.text ||
        fieldErrors ||
        `HTTP ${response.status}`;
      errorMessage = codeStr ? `${codeStr}: ${message}` : message;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }

    if (
      response.status === 409 &&
      parsedBody &&
      typeof parsedBody === "object" &&
      (parsedBody as { type?: unknown }).type === "offer_changed" &&
      typeof (parsedBody as { bookKey?: unknown }).bookKey === "string"
    ) {
      throw new TravelCodeOfferChangedError(parsedBody as OfferChangedDetails);
    }

    switch (response.status) {
      case 400:
      case 422:
        throw new TravelCodeValidationError(errorMessage);
      case 401:
        throw new TravelCodeAuthError(errorMessage);
      case 404:
        throw new TravelCodeNotFoundError(errorMessage);
      default:
        if (response.status >= 500) {
          throw new TravelCodeServerError(errorMessage);
        }
        throw new Error(`API error: ${errorMessage}`);
    }
  }
}
