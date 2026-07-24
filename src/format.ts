import type { ReportFormat } from "./model";

export function formatReportValue(value: unknown, format: ReportFormat | string = "number", signed = false): string {
  if (value === null || value === undefined || value === "") return "—";
  if (format === "date") {
    const raw = String(value);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(`${raw}T00:00:00Z`)
      : new Date(raw);
    return Number.isNaN(date.valueOf())
      ? String(value)
      : new Intl.DateTimeFormat("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: /^\d{4}-\d{2}-\d{2}$/.test(raw) ? "UTC" : undefined
        }).format(date);
  }
  if (format === "text" || typeof value !== "number") return String(value);

  let rendered: string;
  if (format === "currency") {
    rendered = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(value);
  } else if (format === "percent") {
    rendered = new Intl.NumberFormat("en-US", {
      style: "percent",
      maximumFractionDigits: 1
    }).format(value);
  } else {
    rendered = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
  }
  return signed && value > 0 ? `+${rendered}` : rendered;
}
