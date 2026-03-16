import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle, Info, TrendingUp, TrendingDown, Activity, FileText } from "lucide-react";

interface CreditAnalysisData {
  applicant_name?: string;
  pan?: string;
  bureau_type?: string;
  credit_score?: number;
  score_rating?: string;
  report_date?: string;
  summary_stats?: {
    total_accounts?: number;
    active_accounts?: number;
    closed_accounts?: number;
    total_outstanding?: number;
    total_overdue?: number;
    overdue_accounts?: number;
    written_off_accounts?: number;
    enquiries_30d?: number;
    enquiries_90d?: number;
    enquiries_180d?: number;
  };
  key_insights?: string[];
  risk_flags?: string[];
  positive_indicators?: string[];
  recommendation?: string;
  dpd_summary?: string;
}

interface QuickCreditAnalysisViewProps {
  data: CreditAnalysisData;
}

function getScoreColor(score?: number) {
  if (!score) return "text-muted-foreground";
  if (score >= 750) return "text-green-600";
  if (score >= 650) return "text-amber-600";
  return "text-red-600";
}

function getScoreBadgeVariant(rating?: string): "default" | "secondary" | "destructive" | "outline" {
  if (!rating) return "outline";
  const r = rating.toLowerCase();
  if (r === "excellent" || r === "good") return "default";
  if (r === "fair") return "secondary";
  return "destructive";
}

function formatCurrency(amt?: number) {
  if (amt == null) return "₹0";
  return `₹${amt.toLocaleString("en-IN")}`;
}

export function QuickCreditAnalysisView({ data }: QuickCreditAnalysisViewProps) {
  const stats = data.summary_stats || {};

  return (
    <div className="space-y-4">
      {/* Header: Score + Applicant */}
      <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-muted/30">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Applicant</p>
          <p className="text-lg font-semibold">{data.applicant_name || "N/A"}</p>
          {data.pan && <p className="text-sm text-muted-foreground">PAN: {data.pan}</p>}
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {(data.bureau_type || "unknown").toUpperCase()}
            </Badge>
            {data.report_date && (
              <span className="text-xs text-muted-foreground">Report: {data.report_date}</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Credit Score</p>
          <p className={`text-4xl font-bold ${getScoreColor(data.credit_score)}`}>
            {data.credit_score || "N/A"}
          </p>
          {data.score_rating && (
            <Badge variant={getScoreBadgeVariant(data.score_rating)} className="mt-1">
              {data.score_rating}
            </Badge>
          )}
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Accounts" value={stats.total_accounts} />
        <StatCard label="Active" value={stats.active_accounts} />
        <StatCard label="Closed" value={stats.closed_accounts} />
        <StatCard label="Written Off" value={stats.written_off_accounts} alert={!!stats.written_off_accounts} />
        <StatCard label="Outstanding" value={formatCurrency(stats.total_outstanding)} />
        <StatCard label="Overdue" value={formatCurrency(stats.total_overdue)} alert={(stats.total_overdue || 0) > 0} />
        <StatCard label="Enquiries (30d)" value={stats.enquiries_30d} />
        <StatCard label="Enquiries (90d)" value={stats.enquiries_90d} />
      </div>

      {data.dpd_summary && (
        <div className="p-3 rounded-lg border bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground mb-1">DPD Summary</p>
          <p className="text-sm">{data.dpd_summary}</p>
        </div>
      )}

      <Separator />

      {/* Key Insights */}
      {data.key_insights && data.key_insights.length > 0 && (
        <InsightSection
          icon={<Info className="h-4 w-4 text-blue-600" />}
          title="Key Insights"
          items={data.key_insights}
          color="blue"
        />
      )}

      {/* Risk Flags */}
      {data.risk_flags && data.risk_flags.length > 0 && (
        <InsightSection
          icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
          title="Risk Flags"
          items={data.risk_flags}
          color="red"
        />
      )}

      {/* Positive Indicators */}
      {data.positive_indicators && data.positive_indicators.length > 0 && (
        <InsightSection
          icon={<CheckCircle className="h-4 w-4 text-green-600" />}
          title="Positive Indicators"
          items={data.positive_indicators}
          color="green"
        />
      )}

      {/* Recommendation */}
      {data.recommendation && (
        <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Recommendation</span>
          </div>
          <p className="text-sm">{data.recommendation}</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, alert }: { label: string; value?: number | string; alert?: boolean }) {
  return (
    <div className={`p-3 rounded-lg border ${alert ? "border-red-300 bg-red-50 dark:bg-red-950/20" : "bg-muted/20"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${alert ? "text-red-600" : ""}`}>
        {value ?? 0}
      </p>
    </div>
  );
}

function InsightSection({ icon, title, items, color }: { icon: React.ReactNode; title: string; items: string[]; color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <ul className="space-y-1.5 ml-6">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-muted-foreground list-disc">{item}</li>
        ))}
      </ul>
    </div>
  );
}
