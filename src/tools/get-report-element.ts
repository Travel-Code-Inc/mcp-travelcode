import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

const MAX_ROWS = 200;

export const getReportElementSchema = {
  reportId: z.string().describe("Report id (from list_reports)"),
  elementId: z.string().describe("Element id (from get_report layout)"),
  filters: z
    .record(z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .describe(
      "Filter values keyed by filter id from get_report. multi_select — comma-separated option values (e.g. {\"company\": \"1178,1918\"}); country filters take ISO 3166-1 alpha-2 codes (\"US\", \"PL\"), never names; date_range — {\"date_from\": \"2026-01-01\", \"date_to\": \"2026-06-30\"}, filtering by booking/creation date, not stay dates; if omitted, the report's default period (e.g. year-to-date) is applied server-side — results are never all-time unless you pass wide explicit dates; boolean/number — plain values. Drill-in keys (row_click.filter_by, e.g. hotel_key) are also passed here. Unknown keys and invalid values are silently ignored/return empty — an empty result may mean a wrong filter value, not absent data."
    ),
  lang: z.enum(["en", "ru"]).optional().describe("Language for labels (default: account language)"),
};

interface ElementResponse {
  elementId: string;
  type: string;
  data: unknown;
}

interface ReportConfigLite {
  filters?: Array<{
    id: string;
    type: string;
    label?: string;
    default?: unknown;
    source?: string;
    options?: Array<{ value: string; label: string }>;
  }>;
}

/**
 * Best-effort notes about filters the caller did not pass:
 * - multi_select with >1 option — the data spans all of them;
 * - date_range with a server default — the data covers that period, not all-time;
 * - country filters — reminder that values are ISO-2 codes, so a passed-but-empty
 *   result may be a wrong code rather than absent data.
 * No caching: in HTTP mode the client is shared across users and
 * filter options are user-specific.
 */
async function buildUnfilteredNote(
  client: TravelCodeApiClient,
  reportId: string,
  filters: Record<string, string | number | boolean> | undefined,
  lang: string | undefined
): Promise<string> {
  try {
    const cfg = await client.get<ReportConfigLite>(`/reports/${encodeURIComponent(reportId)}`, { lang });
    const notes: string[] = [];
    for (const f of cfg.filters ?? []) {
      const passed = !!filters && f.id in filters;

      if (f.type === "multi_select" && (f.options?.length ?? 0) > 1 && !passed) {
        const name = f.label || f.id;
        const values = (f.options ?? []).map((o) => `${o.label} (${f.id}=${o.value})`).join(", ");
        notes.push(
          `Note: no "${f.id}" filter was applied, so the data spans ALL ${name} options: ${values}. If the user asked about a specific one, ask them which and re-call with filters.${f.id}.`
        );
      }

      if (f.source === "countries" && passed) {
        notes.push(
          `Note: "${f.id}" expects ISO 3166-1 alpha-2 codes (e.g. US, PL). You passed "${filters?.[f.id]}" — if the result is empty, verify the code before concluding there is no data.`
        );
      }

      if (f.type === "date_range" && f.default !== undefined) {
        const dateFrom = filters?.["date_from"];
        const dateTo = filters?.["date_to"];
        if (!dateFrom && !dateTo) {
          notes.push(
            `Note: no date_from/date_to passed, so the server applied the report's default period ${JSON.stringify(f.default)} — this is NOT all-time data. Dates filter by booking/creation date, not stay dates. State the effective period in your answer; pass explicit dates for other periods.`
          );
        }
      }
    }
    return notes.length ? `\n\n${notes.join("\n")}` : "";
  } catch {
    return "";
  }
}

export function registerGetReportElement(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_report_element",
    "Fetch the data of one report element (table rows, KPI counters, chart series) with optional filters. Universal endpoint — works for any report and element listed by get_report.",
    getReportElementSchema,
    READ_ONLY_TOOL,
    async ({ reportId, elementId, filters, lang }) => {
      try {
        const params: Record<string, string | number | boolean | undefined> = { ...(filters ?? {}), lang };
        const data = await client.get<ElementResponse>(
          `/reports/${encodeURIComponent(reportId)}/elements/${encodeURIComponent(elementId)}`,
          params
        );

        let payload = data.data;
        let note = "";
        if (Array.isArray(payload) && payload.length > MAX_ROWS) {
          note = `\n\n(Showing first ${MAX_ROWS} of ${payload.length} rows — narrow with filters to see the rest.)`;
          payload = payload.slice(0, MAX_ROWS);
        }

        const unfilteredNote = await buildUnfilteredNote(client, reportId, filters, lang);

        const text = `Element ${data.elementId} (${data.type}):\n${JSON.stringify(payload, null, 1)}${note}${unfilteredNote}`;
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting element "${elementId}" of report "${reportId}": ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
