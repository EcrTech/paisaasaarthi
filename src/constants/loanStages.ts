// Single source of truth for loan stage constants.
// Every dashboard, component, hook, and report should import from here.

export const LOAN_STAGES = [
  { value: "lead",         label: "Lead",         color: "bg-slate-500",  chartColor: "#94A3B8", order: 0 },
  { value: "application",  label: "Application",  color: "bg-sky-500",    chartColor: "#8AD4EB", order: 1 },
  { value: "documents",    label: "Documents",     color: "bg-blue-500",   chartColor: "#01B8AA", order: 2 },
  { value: "evaluation",   label: "Evaluation",    color: "bg-indigo-500", chartColor: "#F2C80F", order: 3 },
  { value: "approved",     label: "Approved",      color: "bg-amber-500",  chartColor: "#FE9666", order: 4 },
  { value: "disbursement", label: "Disbursement",  color: "bg-cyan-500",   chartColor: "#3B82F6", order: 5 },
  { value: "disbursed",    label: "Disbursed",     color: "bg-green-500",  chartColor: "#22C55E", order: 6 },
  { value: "closed",       label: "Closed",        color: "bg-gray-500",   chartColor: "#6366F1", order: 7 },
  { value: "rejected",     label: "Rejected",      color: "bg-red-500",    chartColor: "#FD625E", order: -1 },
] as const;

/** stage value → display label */
export const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  LOAN_STAGES.map((s) => [s.value, s.label]),
);

/** stage value → tailwind badge class */
export const STAGE_COLORS: Record<string, string> = Object.fromEntries(
  LOAN_STAGES.map((s) => [s.value, s.color]),
);

/** stage value → hex color for charts */
export const STAGE_CHART_COLORS: Record<string, string> = Object.fromEntries(
  LOAN_STAGES.map((s) => [s.value, s.chartColor]),
);

/** stage value → numeric sort order */
export const STAGE_ORDER: Record<string, number> = Object.fromEntries(
  LOAN_STAGES.map((s) => [s.value, s.order]),
);

/** Badge classes for approval queue / detail views (with text + border) */
export const STAGE_BADGE_COLORS: Record<string, string> = {
  lead:         "bg-slate-500/10 text-slate-600 border-slate-500/20",
  application:  "bg-sky-500/10 text-sky-600 border-sky-500/20",
  documents:    "bg-blue-500/10 text-blue-600 border-blue-500/20",
  evaluation:   "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  approved:     "bg-amber-500/10 text-amber-600 border-amber-500/20",
  disbursement: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  disbursed:    "bg-green-500/10 text-green-600 border-green-500/20",
  closed:       "bg-gray-500/10 text-gray-600 border-gray-500/20",
  rejected:     "bg-red-500/10 text-red-600 border-red-500/20",
};

/** Badge variant for history cards */
export const STAGE_BADGE_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  lead:         "outline",
  application:  "outline",
  documents:    "secondary",
  evaluation:   "secondary",
  approved:     "default",
  disbursement: "secondary",
  disbursed:    "default",
  closed:       "outline",
  rejected:     "destructive",
};

/** status field colors (auto-synced from stage via DB trigger) */
export const STATUS_COLORS: Record<string, string> = {
  draft:       "bg-muted",
  in_progress: "bg-blue-500",
  approved:    "bg-green-500",
  rejected:    "bg-red-500",
  closed:      "bg-gray-500",
};

/** Stage options for filter dropdowns */
export const STAGE_OPTIONS = [
  { value: "all", label: "All Stages" },
  ...LOAN_STAGES.filter((s) => s.value !== "rejected").map((s) => ({
    value: s.value,
    label: s.label,
  })),
  { value: "rejected", label: "Rejected" },
];

/** Progress bar stages (linear flow, excluding lead and rejected) */
export const PROGRESS_STAGES = [
  "application", "documents", "evaluation", "approved", "disbursement", "disbursed", "closed",
] as const;

// --- Lead source labels ---

export const SOURCE_LABELS: Record<string, string> = {
  referral_link: "Referral Link",
  referral: "Referral",
  public_form: "Public Form",
  bulk_upload: "Bulk Upload",
  bulk_import: "Bulk Import",
  loan_application: "Loan Application",
  "Google Ads": "Google Ads",
  "Meta Ads": "Meta Ads",
  "Reapply Quick": "Reapply Quick",
  "Repeat Loan": "Repeat Loan",
  repeat_loan: "Repeat Loan",
  Direct: "Direct",
  unknown: "Unknown",
};
