/**
 * Helpers for registering MCP tools that support OAuth-admin impersonation.
 *
 * Usage in a tool file:
 *
 *   const schema = { ...listOrdersSchema, ...impersonationInputSchema };
 *
 *   server.tool("list_orders", description, schema, withImpersonation(async (args) => {
 *     // args.actAs / args.actAsCompanyId are stripped before we get here
 *     ...
 *   }));
 *
 * If the server rejects the call with IMPERSONATION_COMPANY_REQUIRED, the
 * wrapper auto-replies with a structured prompt that lists the target user's
 * companies, so the LLM can present them to the user and retry with
 * actAsCompanyId set.
 */
import {
  impersonationContext,
  impersonationInputSchema,
  TargetCompany,
  TravelCodeImpersonationCompanyRequiredError,
} from "./impersonation.js";

type AnyArgs = Record<string, unknown>;

export type ImpersonatedArgs<TArgs extends AnyArgs> = TArgs & {
  actAs?: string;
  actAsCompanyId?: string | number;
};

/**
 * Wrap a tool handler so that `actAs` / `actAsCompanyId` are pulled out of the
 * call arguments and put into the AsyncLocalStorage context that the api-client
 * reads. Existing tool handlers don't need any change beyond merging the
 * impersonation shape into their schema. The return type is preserved as-is
 * so MCP's CallToolResult inference still works at the call site.
 */
export function withImpersonation<TArgs extends AnyArgs, TResult, TExtra>(
  handler: (args: TArgs, extra: TExtra) => Promise<TResult> | TResult,
): (args: ImpersonatedArgs<TArgs>, extra: TExtra) => Promise<TResult> {
  return async (args, extra) => {
    const { actAs, actAsCompanyId, ...rest } = (args ?? {}) as ImpersonatedArgs<TArgs>;
    const cleanArgs = rest as TArgs;
    if (!actAs) {
      return await handler(cleanArgs, extra);
    }
    try {
      return await impersonationContext.run(
        { actAs, actAsCompanyId },
        async () => handler(cleanArgs, extra),
      );
    } catch (err) {
      if (err instanceof TravelCodeImpersonationCompanyRequiredError) {
        return formatCompanyChoice(err.actAs, err.companies) as unknown as TResult;
      }
      throw err;
    }
  };
}

function formatCompanyChoice(actAs: string | undefined, companies: TargetCompany[]) {
  const header = `User ${actAs ?? "(unknown)"} has multiple companies. Ask the user to pick one and retry the previous tool call with actAsCompanyId set to the chosen ID.`;
  if (companies.length === 0) {
    return {
      content: [{
        type: "text" as const,
        text: `${header}\n\n(Could not auto-fetch the list — call list_target_companies with actAs="${actAs ?? ""}" to see options.)`,
      }],
    };
  }
  const lines = companies.map((c) => {
    const name = c.legalName || c.name || `Company ${c.id}`;
    const tail = c.taxIdentificationNumber ? ` — ${c.taxIdentificationNumber}` : "";
    return `- ${name}${tail} (id=${c.id})`;
  });
  return {
    content: [{
      type: "text" as const,
      text: `${header}\n\n${lines.join("\n")}`,
    }],
  };
}

export { impersonationInputSchema, impersonationContext } from "./impersonation.js";
