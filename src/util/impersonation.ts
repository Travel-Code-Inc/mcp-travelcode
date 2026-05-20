/**
 * OAuth-admin impersonation support for the TravelCode REST API.
 *
 * When an admin (authenticated via OAuth/MCP) wants to act on behalf of
 * another user, we pass:
 *   X-On-Behalf-Of           target user email
 *   X-On-Behalf-Of-Company   target legal-entity ID (only when needed)
 *
 * Tool handlers don't pass these through manually. Instead, the wrapper
 * `registerToolWithImpersonation` puts them into the AsyncLocalStorage
 * `impersonationContext`, and the api-client reads from it on each request.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";

export interface ImpersonationState {
  actAs?: string;
  actAsCompanyId?: string | number;
}

export const impersonationContext = new AsyncLocalStorage<ImpersonationState>();

/**
 * Optional Zod fields appended to every impersonation-aware tool's input
 * schema. Keep names matching what the LLM is likely to surface to the user.
 */
export const impersonationInputSchema = {
  actAs: z
    .string()
    .email()
    .optional()
    .describe(
      "Target user email. Set this to act on behalf of another user (admin-only via OAuth). The call uses HTTP header X-On-Behalf-Of.",
    ),
  actAsCompanyId: z
    .union([z.string(), z.number()])
    .optional()
    .describe(
      "Target user's legal-entity (company) ID. Required only when the target user has multiple companies — call list_target_companies first to discover IDs.",
    ),
};

/**
 * Build the HTTP headers for impersonation. Returns an empty object when no
 * actAs is set, so it's safe to spread unconditionally.
 */
export function impersonationHeaders(state?: ImpersonationState): Record<string, string> {
  const s = state ?? impersonationContext.getStore();
  if (!s?.actAs) return {};
  const headers: Record<string, string> = { "X-On-Behalf-Of": s.actAs };
  if (s.actAsCompanyId !== undefined && s.actAsCompanyId !== "") {
    headers["X-On-Behalf-Of-Company"] = String(s.actAsCompanyId);
  }
  return headers;
}

/**
 * Thrown when the server responds with IMPERSONATION_COMPANY_REQUIRED
 * (HTTP 400, internal code 74). The tool handler / LLM should call
 * `list_target_companies` with the same `actAs`, ask the user to pick
 * one, then retry the original call with `actAsCompanyId` set.
 */
export interface TargetCompany {
  id: number;
  name?: string;
  legalName?: string;
  taxIdentificationNumber?: string;
}

export class TravelCodeImpersonationCompanyRequiredError extends Error {
  public readonly actAs?: string;
  public readonly companies: TargetCompany[];
  constructor(actAs?: string, companies: TargetCompany[] = []) {
    super(
      `Target user has multiple companies. Ask the user to pick one and retry with actAsCompanyId.`,
    );
    this.name = "TravelCodeImpersonationCompanyRequiredError";
    this.actAs = actAs;
    this.companies = companies;
  }
}
