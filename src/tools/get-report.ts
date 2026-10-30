import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "../client/api-client.js";
import { READ_ONLY_TOOL } from "../util/tool-annotations.js";

export const getReportSchema = {
  reportId: z.string().describe("Report id (from list_reports), e.g. \"most-booked-hotels\""),
  lang: z.enum(["en", "ru"]).optional().describe("Language for labels (default: account language)"),
};

interface ReportFilter {
  id: string;
  type: string;
  label?: string;
  default?: unknown;
  source?: string;
  options?: Array<{ value: string; label: string }>;
}

interface ReportElement {
  id: string;
  type: string;
  title?: string;
  columns?: Array<{ id: string; label?: string; type?: string; hidden?: boolean }>;
  label_field?: string;
  value_field?: string;
  tiles?: Array<{ id: string; label?: string }>;
  row_click?: { action?: string; filter_by?: string };
}

interface ReportConfig {
  id: string;
  title?: string;
  description?: string;
  filters?: ReportFilter[];
  layout?: ReportElement[];
  drill_in?: { layout?: string[] };
  syncable?: boolean;
}

export function registerGetReport(server: McpServer, client: TravelCodeApiClient) {
  server.tool(
    "get_report",
    "Get a report's structure: its filters (with allowed values) and its data elements (tables, KPI tiles, charts). Use this before get_report_element to learn which element ids exist and which filter keys they accept. Works for any report id.",
    getReportSchema,
    READ_ONLY_TOOL,
    async ({ reportId, lang }) => {
      try {
        const data = await client.get<ReportConfig>(`/reports/${encodeURIComponent(reportId)}`, { lang });

        const filters = (data.filters ?? []).map((f) => {
          const parts = [`- ${f.id} (${f.type})${f.label ? ` — ${f.label}` : ""}`];
          if (f.type === "date_range") {
            parts.push("  pass as: date_from / date_to (YYYY-MM-DD). Filters by the record's booking/creation date, not stay or travel dates.");
          }
          if (f.options?.length) {
            parts.push(`  options: ${f.options.map((o) => `${o.value}=${JSON.stringify(o.label)}`).join(", ")}`);
          } else if (f.source === "countries") {
            parts.push('  values: ISO 3166-1 alpha-2 country codes, comma-separated (e.g. "US", "PL", "US,GB") — NOT country names like "USA" or "Poland". A wrong value silently returns empty data.');
          } else if (f.type === "multi_select") {
            parts.push("  values: raw ids/codes, not display names.");
          }
          if (f.default !== undefined) {
            parts.push(`  default: ${JSON.stringify(f.default)}`);
            if (f.type === "date_range") {
              parts.push("  NOTE: if date_from/date_to are omitted, the server APPLIES this default period — results are NOT all-time. Pass explicit dates for other periods, and mention the effective period in your answer.");
            }
          }
          return parts.join("\n");
        });

        const elements = (data.layout ?? []).map((e) => {
          const parts = [`- ${e.id} (${e.type})${e.title ? ` — ${e.title}` : ""}`];
          if (e.columns?.length) {
            parts.push(`  columns: ${e.columns.map((c) => c.id).join(", ")}`);
          }
          if (e.tiles?.length) {
            parts.push(`  tiles: ${e.tiles.map((t) => t.id).join(", ")}`);
          }
          if (e.row_click?.filter_by) {
            parts.push(`  drill-in key: ${e.row_click.filter_by} (pass a row's value as a filter to narrow other elements)`);
          }
          return parts.join("\n");
        });

        const sections = [
          `Report: ${data.id}${data.title ? ` — ${data.title}` : ""}`,
          data.description ?? "",
          filters.length ? `Filters (pass to get_report_element):\n${filters.join("\n")}` : "No filters.",
          elements.length ? `Elements (each is fetched separately via get_report_element):\n${elements.join("\n")}` : "No elements.",
          data.drill_in?.layout?.length ? `Drill-in elements (meaningful with the drill-in key filter set): ${data.drill_in.layout.join(", ")}` : "",
        ].filter(Boolean);

        return { content: [{ type: "text", text: sections.join("\n\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting report "${reportId}": ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
