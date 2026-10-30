/**
 * Server-side confirmation for tools that spend money or reach people.
 *
 * Tool annotations are only hints, so the server itself refuses to act on the
 * first call. When the client supports elicitation, the server asks the person
 * directly ("Confirm / Cancel") and the model cannot answer for them. Otherwise
 * the first call returns a summary plus a single-use token bound to the MCP
 * session and to the exact arguments; only a second call carrying that token,
 * after the person said yes, runs the action.
 */
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const TOKEN_TTL_MS = 10 * 60_000;

export const confirmationInputSchema = {
  confirmation_token: z
    .string()
    .optional()
    .describe(
      "Leave empty on the first call. Only after the user explicitly said yes to the summary the server returned, call again with exactly the same arguments plus this token.",
    ),
};

interface PendingConfirmation {
  key: string;
  expiresAt: number;
}

const pending = new Map<string, PendingConfirmation>();

function sweep(now: number): void {
  for (const [token, entry] of pending) {
    if (entry.expiresAt <= now) pending.delete(token);
  }
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
        .map((k) => [k, stable((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

function confirmationKey(tool: string, sessionId: string | undefined, args: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify([tool, sessionId ?? "", stable(args)]))
    .digest("hex");
}

type ToolText = { content: Array<{ type: "text"; text: string }>; isError?: boolean };
type Extra = { sessionId?: string };

function text(message: string, isError = false): ToolText {
  return { content: [{ type: "text", text: message }], ...(isError ? { isError: true } : {}) };
}

async function askPerson(server: McpServer, summary: string): Promise<"yes" | "no" | "unsupported"> {
  if (!server.server.getClientCapabilities()?.elicitation) return "unsupported";
  try {
    const answer = await server.server.elicitInput({
      message: `${summary}\n\nConfirm?`,
      requestedSchema: {
        type: "object",
        properties: {
          confirm: { type: "boolean", title: "Confirm", description: "Yes, do it" },
        },
        required: ["confirm"],
      },
    });
    return answer.action === "accept" && answer.content?.confirm === true ? "yes" : "no";
  } catch {
    return "unsupported";
  }
}

/**
 * Wrap a tool handler so it runs only after the person confirmed. `summarize`
 * describes the action in plain words; it may read data (e.g. the penalty).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withConfirmation<H extends (args: any, extra: any) => any>(
  server: McpServer,
  tool: string,
  summarize: (args: Record<string, unknown>) => Promise<string> | string,
  handler: H,
): H {
  const wrapped = async (rawArgs: Record<string, unknown> & { confirmation_token?: string }, extra: Extra) => {
    const { confirmation_token: token, ...rest } = rawArgs;
    const args = rest as Record<string, unknown>;
    const now = Date.now();
    sweep(now);
    const key = confirmationKey(tool, extra?.sessionId, args);

    if (token) {
      const entry = pending.get(token);
      if (!entry || entry.key !== key) {
        return text(
          "Nothing was done: this confirmation is unknown, expired or was given for different details. Show the user the action again and ask for a fresh yes.",
          true,
        );
      }
      pending.delete(token);
      return handler(args, extra);
    }

    const summary = await summarize(args);
    const answer = await askPerson(server, summary);
    if (answer === "yes") return handler(args, extra);
    if (answer === "no") return text("The user did not confirm. Nothing was done.");

    const issued = randomBytes(12).toString("hex");
    pending.set(issued, { key, expiresAt: now + TOKEN_TTL_MS });
    return text(
      [
        "NOT DONE YET — this action needs the user's explicit confirmation.",
        "",
        "Show the user exactly this and ask whether to go ahead:",
        summary,
        "",
        `Only after the user says yes in their next message, call ${tool} again with exactly the same arguments plus confirmation_token="${issued}". Never confirm on the user's behalf. The token works once and expires in 10 minutes; never show it to the user.`,
      ].join("\n"),
    );
  };
  return wrapped as unknown as H;
}

/** Test hook: forget every pending confirmation. */
export function resetConfirmations(): void {
  pending.clear();
}
