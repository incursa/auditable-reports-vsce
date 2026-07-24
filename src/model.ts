export type ReportFormat = "number" | "currency" | "percent";

export interface ReportArtifact {
  readonly surface: "report";
  readonly reportConfig?: {
    readonly documentType?: string;
    readonly orientation?: "portrait" | "landscape";
    readonly pageSize?: string;
    readonly sourceDisplay?: "visible" | "hidden";
    readonly dateDisplay?: "timestamp" | "date-only" | "hidden";
    readonly pdfName?: string;
  };
  readonly manifest: {
    readonly title: string;
    readonly description: string;
    readonly generatedAt: string;
    readonly cards: readonly ReportCard[];
    readonly charts: readonly ReportChart[];
    readonly tables: readonly ReportTable[];
    readonly sources: readonly ReportSource[];
    readonly blocks: readonly ReportBlock[];
  };
  readonly snapshot: {
    readonly status: string;
    readonly datasets: Readonly<Record<string, readonly Record<string, unknown>[]>>;
  };
  readonly sources: readonly ReportSource[];
}

export interface ReportSource {
  readonly id: string;
  readonly label: string;
  readonly path?: string;
}

export interface ReportCard {
  readonly id: string;
  readonly description?: string;
  readonly dataset: string;
  readonly sourceId: string;
  readonly metrics: readonly {
    readonly label: string;
    readonly field: string;
    readonly format?: ReportFormat;
    readonly signed?: boolean;
  }[];
}

export interface ReportChart {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly type: "bar" | "pie";
  readonly dataset: string;
  readonly sourceId: string;
  readonly valueFormat?: ReportFormat;
  readonly encodings: {
    readonly x: { readonly field: string; readonly label?: string };
    readonly y: { readonly field: string; readonly label?: string; readonly format?: ReportFormat };
  };
}

export interface ReportTable {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly dataset: string;
  readonly sourceId: string;
  readonly kind?: string;
  readonly defaultSort?: {
    readonly field: string;
    readonly direction: "asc" | "desc";
  };
  readonly columns: readonly {
    readonly field: string;
    readonly label: string;
    readonly type?: string;
    readonly format?: ReportFormat;
    readonly role?: string;
    readonly movement?: boolean;
  }[];
}

export interface ReportBlock {
  readonly id: string;
  readonly type: "markdown" | "metric-strip" | "chart" | "table" | "html";
  readonly body?: string;
  readonly sourceId?: string;
  readonly cardIds?: readonly string[];
  readonly chartId?: string;
  readonly tableId?: string;
  readonly breakBefore?: string;
  readonly keepTogether?: boolean;
}

export interface PreviewMessage {
  readonly type: "render";
  readonly artifact: ReportArtifact;
  readonly documentLabel: string;
  readonly preserveScroll: boolean;
  readonly compiledAt: string;
}
