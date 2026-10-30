import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/** Only reads data; safe to call without asking the user. */
export const READ_ONLY_TOOL: ToolAnnotations = {
  readOnlyHint: true,
};

/** Writes data, but only adds to it (creates something new). */
export const ADDITIVE_WRITE_TOOL: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
};

/** Changes, overwrites or removes existing data, or reaches out to people. */
export const DESTRUCTIVE_WRITE_TOOL: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
};
