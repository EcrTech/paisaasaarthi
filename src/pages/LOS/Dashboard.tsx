import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  CheckCircle,
  Clock,
  TrendingUp,
  IndianRupee,
  Users,
  AlertCircle,
  CalendarIcon,
} from "lucide-react";
import { LoadingState } from "@/components/common/LoadingState";
import { Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import StaffPerformanceDashboard from "@/components/LOS/Reports/StaffPerformanceDashboard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, subDays, startOfMonth } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useLOSPermissions } from "@/hooks/useLOSPermissions";

const STAGE_COLORS: Record<string, string> = {
  application_login: "#8AD4EB",
  document_collection: "#01B8AA",
  field_verification: "#168980",
  credit_assessment: "#F2C80F",
  approval_pending: "#FE9666",
  sanctioned: "#A66999",
  disbursement_pending: "#3B82F6",
  disbursed: "#22C55E",
  rejected: "#FD625E",
  cancelled: "#9CA3AF",
  closed: "#6366F1",
};

const SOURCE_LABELS: Record<string, string> = {
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
  Direct: "Direct",
  unknown: "Unknown",
};

// Distinct color palette for lead sources — cycled for any number of sources
const SOURCE_COLOR_PALETTE = [
  "#01B8AA", "#E8532B", "#3B82F6", "#F2C80F", "#8B5CF6",
  "#22C55E", "#EC4899", "#F97316", "#06B6D4", "#6366F1",
  "#EF4444", "#14B8A6", "#A855F7", "#84CC16", "#D946EF",
];

const getSourceColor = (sources: string[], src: string) => {
  const idx = sources.indexOf(src);
  return SOURCE_COLOR_PALETTE[idx >= 0 ? idx % SOURCE_COLOR_PALETTE.length : 0];
};

export default function LOSDashboard() {
  const { orgId } = useOrgContext();
  const navigate = useNavigate();
  const { permissions } = useLOSPermissions();
  const [fromDate, setFromDate] = useState<Date>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date>(new Date());
  const [chartView, setChartView] = useState<"daily" | "monthly">("daily");

  // Single RPC replaces 5 parallel queries + client-side dedup/aggregation
  const { data: stats, isLoading } = useQuery({
    queryKey: ["los-stats", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_los_dashboard_stats", { p_org_id: orgId });
      if (error) throw error;
      return data as {
        totalApps: number;
        disbursed: number;
        pendingApproval: number;
        inProgress: number;
        totalSanctioned: number;
        totalDisbursedAmount: number;
        pendingEMIs: number;
        overdueEMIs: number;
      };
    },
    enabled: !!orgId,
  });

  // Stage distribution via RPC (server-side GROUP BY)
  const { data: stageDistribution } = useQuery({
    queryKey: ["los-stage-distribution", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_stage_distribution", { p_org_id: orgId });
      if (error) throw error;
      return (data as { stage: string; count: number; sort_order: number }[]).map((d) => ({
        stage: d.stage,
        label: STAGE_LABELS[d.stage] || d.stage,
        count: d.count,
        fill: STAGE_COLORS[d.stage] || "#8884d8",
      }));
    },
    enabled: !!orgId,
  });

  // Disbursement trend via RPC (server-side date bucketing)
  const { data: disbursementTrend } = useQuery({
    queryKey: ["los-disbursement-trend", orgId, chartView],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_disbursement_trend", {
        p_org_id: orgId,
        p_daily: chartView === "daily",
      });
      if (error) throw error;
      return data as { label: string; amount: number; count: number }[];
    },
    enabled: !!orgId,
  });

  // Leads by source via RPC (server-side source+date bucketing)
  const { data: leadsBySourceTrend } = useQuery({
    queryKey: ["los-leads-by-source-trend", orgId, chartView],
    queryFn: async () => {
      const { data: rpcData, error } = await supabase.rpc("get_leads_by_source_trend", {
        p_org_id: orgId,
        p_daily: chartView === "daily",
      });
      if (error) throw error;

      const raw = rpcData as { sources: string[]; data: { label: string; bucket: string; source: string; count: number }[] };
      const sources = raw.sources || [];

      // Pivot: group by bucket, spread sources as keys
      const bucketMap = new Map<string, Record<string, any>>();
      for (const row of raw.data) {
        if (!bucketMap.has(row.bucket)) {
          bucketMap.set(row.bucket, { label: row.label });
        }
        bucketMap.get(row.bucket)![row.source] = row.count;
      }

      // Fill missing sources with 0
      const result = Array.from(bucketMap.values()).map((row) => {
        for (const src of sources) {
          if (!(src in row)) row[src] = 0;
        }
        return row;
      });

      return { data: result, sources };
    },
    enabled: !!orgId,
  });

  // Collections cash flow via RPC (server-side EMI aggregation)
  const { data: cashFlowData } = useQuery({
    queryKey: ["los-cashflow", orgId, chartView],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cashflow_data", {
        p_org_id: orgId,
        p_daily: chartView === "daily",
      });
      if (error) throw error;
      return data as {
        chartData: { label: string; fullLabel: string; expected: number; collected: number | null; projected: number | null; overdue: number | null }[];
        summary: { totalExpected: number; totalCollected: number; totalOverdue: number; next3MonthsProjected: number; collectionRate: number };
      };
    },
    enabled: !!orgId,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const STAGE_LABELS: Record<string, string> = {
    application_login: "Application Login",
    document_collection: "Document Collection",
    field_verification: "Field Verification",
    credit_assessment: "Credit Assessment",
    approval_pending: "Approval Pending",
    sanctioned: "Sanctioned",
    rejected: "Rejected",
    disbursement_pending: "Disbursement Pending",
    disbursed: "Disbursed",
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading dashboard..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">LOS Dashboard</h1>
            <p className="text-muted-foreground">
              Loan Origination System overview and statistics
            </p>
          </div>
        </div>

        {/* Stats Grid — compact, single row */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <FileText className="h-3 w-3" />
                Applications
              </div>
              <div className="text-xl font-bold">{stats?.totalApps || 0}</div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Clock className="h-3 w-3 text-yellow-600" />
                Pending
              </div>
              <div className="text-xl font-bold text-yellow-600">
                {stats?.pendingApproval || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <TrendingUp className="h-3 w-3 text-blue-600" />
                In Progress
              </div>
              <div className="text-xl font-bold text-blue-600">
                {stats?.inProgress || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <CheckCircle className="h-3 w-3 text-green-600" />
                Disbursed
              </div>
              <div className="text-xl font-bold text-green-600">
                {stats?.disbursed || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <IndianRupee className="h-3 w-3" />
                Sanctioned
              </div>
              <div className="text-xl font-bold text-primary">
                {formatCurrency(stats?.totalSanctioned || 0)}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <IndianRupee className="h-3 w-3 text-green-600" />
                Disbursed Amt
              </div>
              <div className="text-xl font-bold text-green-600">
                {formatCurrency(stats?.totalDisbursedAmount || 0)}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Clock className="h-3 w-3 text-blue-600" />
                Pending EMIs
              </div>
              <div className="text-xl font-bold text-blue-600">
                {stats?.pendingEMIs || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <AlertCircle className="h-3 w-3 text-red-600" />
                Overdue EMIs
              </div>
              <div className="text-xl font-bold text-red-600">
                {stats?.overdueEMIs || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily / Monthly toggle */}
        <div className="flex items-center gap-2">
          <Tabs value={chartView} onValueChange={(v) => setChartView(v as "daily" | "monthly")}>
            <TabsList className="h-8">
              <TabsTrigger value="daily" className="text-xs px-3 h-7">Daily</TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs px-3 h-7">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="text-xs text-muted-foreground">
            {chartView === "daily" ? format(startOfMonth(new Date()), "MMM yyyy") : "Last 6 months"}
          </span>
        </div>

        {/* Leads by Source — full width area chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads by Source</CardTitle>
            <CardDescription>{chartView === "daily" ? "Day-wise this month" : "Monthly trend (6 months)"}</CardDescription>
          </CardHeader>
          <CardContent>
            {leadsBySourceTrend && leadsBySourceTrend.data.length > 0 && leadsBySourceTrend.sources.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={leadsBySourceTrend.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  {leadsBySourceTrend.sources.map((src) => (
                    <Area
                      key={src}
                      type="monotone"
                      dataKey={src}
                      name={SOURCE_LABELS[src] || src.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      stackId="1"
                      stroke={getSourceColor(leadsBySourceTrend.sources, src)}
                      fill={getSourceColor(leadsBySourceTrend.sources, src)}
                      fillOpacity={0.6}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No lead data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Application Pipeline + Disbursement Trend side by side */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Application Stage Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Application Pipeline</CardTitle>
              <CardDescription>Applications by current stage</CardDescription>
            </CardHeader>
            <CardContent>
              {stageDistribution && stageDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stageDistribution} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => [value, "Applications"]}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {stageDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                  No application data yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Disbursement Trend — gradient area chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Disbursement Trend</CardTitle>
              <CardDescription>{chartView === "daily" ? "Day-wise this month" : "Last 6 months"}</CardDescription>
            </CardHeader>
            <CardContent>
              {disbursementTrend && disbursementTrend.some(d => d.amount > 0) ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={disbursementTrend}>
                    <defs>
                      <linearGradient id="disbursementGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) =>
                        v >= 10000000
                          ? `${(v / 10000000).toFixed(1)}Cr`
                          : v >= 100000
                          ? `${(v / 100000).toFixed(1)}L`
                          : v >= 1000
                          ? `${(v / 1000).toFixed(0)}K`
                          : v.toString()
                      }
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value),
                        "Disbursed",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#22C55E"
                      strokeWidth={2.5}
                      fill="url(#disbursementGradient)"
                      dot={{ r: 4, fill: "#22C55E", strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 6, fill: "#22C55E", strokeWidth: 2, stroke: "#fff" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                  No disbursement data yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Collections & Cash Flow */}
        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-bold">Collections & Cash Flow</h2>
            <p className="text-sm text-muted-foreground">Actual collections vs projected EMI cash flows</p>
          </div>

          {/* Summary cards */}
          {cashFlowData?.summary && (
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <Card className="shadow-sm">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground mb-1">Collection Rate</div>
                  <div className={cn("text-xl font-bold", cashFlowData.summary.collectionRate >= 80 ? "text-green-600" : cashFlowData.summary.collectionRate >= 50 ? "text-yellow-600" : "text-red-600")}>
                    {cashFlowData.summary.collectionRate}%
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground mb-1">Total Collected</div>
                  <div className="text-xl font-bold text-green-600">
                    {formatCurrency(cashFlowData.summary.totalCollected)}
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground mb-1">Overdue Amount</div>
                  <div className="text-xl font-bold text-red-600">
                    {formatCurrency(cashFlowData.summary.totalOverdue)}
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground mb-1">Next 3 Months Projected</div>
                  <div className="text-xl font-bold text-blue-600">
                    {formatCurrency(cashFlowData.summary.next3MonthsProjected)}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Cash flow chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cash Flow — Actual vs Projected</CardTitle>
              <CardDescription>{chartView === "daily" ? "Day-wise this month" : "Past 6 months collections and next 6 months projected EMIs"}</CardDescription>
            </CardHeader>
            <CardContent>
              {cashFlowData?.chartData && cashFlowData.chartData.some((d: any) => (d.expected || 0) > 0) ? (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={cashFlowData.chartData}>
                    <defs>
                      <linearGradient id="collectedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="projectedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="overdueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) =>
                        v >= 10000000
                          ? `${(v / 10000000).toFixed(1)}Cr`
                          : v >= 100000
                          ? `${(v / 100000).toFixed(1)}L`
                          : v >= 1000
                          ? `${(v / 1000).toFixed(0)}K`
                          : v.toString()
                      }
                    />
                    <Tooltip
                      formatter={(value: number | null, name: string) => [
                        value != null
                          ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value)
                          : "—",
                        name,
                      ]}
                      labelFormatter={(label) => {
                        const item = cashFlowData.chartData.find((d: any) => d.label === label);
                        return item?.fullLabel || label;
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="collected"
                      name="Collected"
                      stroke="#22C55E"
                      strokeWidth={2.5}
                      fill="url(#collectedGradient)"
                      dot={{ r: 3, fill: "#22C55E", strokeWidth: 2, stroke: "#fff" }}
                      connectNulls={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="projected"
                      name="Projected"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      fill="url(#projectedGradient)"
                      dot={{ r: 3, fill: "#3B82F6", strokeWidth: 2, stroke: "#fff" }}
                      connectNulls={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="overdue"
                      name="Overdue"
                      stroke="#EF4444"
                      strokeWidth={2}
                      fill="url(#overdueGradient)"
                      dot={{ r: 3, fill: "#EF4444", strokeWidth: 2, stroke: "#fff" }}
                      connectNulls={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[320px] flex items-center justify-center text-muted-foreground">
                  No collection data yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Team Performance */}
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h2 className="text-xl font-bold">Team Performance</h2>
              <p className="text-sm text-muted-foreground">Agent metrics from leads to disbursement</p>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-[130px] justify-start text-left font-normal",
                      !fromDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {fromDate ? format(fromDate, "dd MMM yyyy") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={(date) => date && setFromDate(date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-sm">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-[130px] justify-start text-left font-normal",
                      !toDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {toDate ? format(toDate, "dd MMM yyyy") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={toDate}
                    onSelect={(date) => date && setToDate(date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <StaffPerformanceDashboard fromDate={fromDate} toDate={toDate} agentOnly />
        </div>

        {/* Quick Actions */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <Button
                variant="outline"
                size="sm"
                className="h-auto py-2.5 flex-col gap-1"
                onClick={() => navigate("/los/my-referrals")}
              >
                <FileText className="h-4 w-4" />
                <span className="text-xs">My Referrals</span>
              </Button>
              {permissions.canApproveLoans && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto py-2.5 flex-col gap-1"
                  onClick={() => navigate("/los/approval-queue")}
                >
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs">Approval Queue</span>
                </Button>
              )}
              {permissions.canViewApplications && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto py-2.5 flex-col gap-1"
                  onClick={() => navigate("/los/applications")}
                >
                  <Users className="h-4 w-4" />
                  <span className="text-xs">All Applications</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-auto py-2.5 flex-col gap-1"
                onClick={() => navigate("/los/bulk-payment-report")}
              >
                <FileText className="h-4 w-4" />
                <span className="text-xs">Bulk Payment</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
