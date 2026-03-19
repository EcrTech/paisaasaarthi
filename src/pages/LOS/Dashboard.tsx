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
import { format, subDays, subMonths, addMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";

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
};

const SOURCE_COLORS: Record<string, string> = {
  referral_link: "#01B8AA",
  referral: "#168980",
  public_form: "#8AD4EB",
  bulk_upload: "#F2C80F",
  bulk_import: "#A66999",
  loan_application: "#FE9666",
  unknown: "#9CA3AF",
};

export default function LOSDashboard() {
  const { orgId } = useOrgContext();
  const navigate = useNavigate();
  const { permissions } = useLOSPermissions();
  const [fromDate, setFromDate] = useState<Date>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date>(new Date());

  // Fetch all stats in a single query function with Promise.all for parallel execution
  const { data: stats, isLoading } = useQuery({
    queryKey: ["los-stats", orgId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      // Helper to fetch all rows with pagination (PostgREST caps at 1000 per request)
      const fetchAllRows = async (buildQuery: () => any) => {
        const PAGE_SIZE = 1000;
        let allData: any[] = [];
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
          if (error) throw error;
          allData = allData.concat(data || []);
          hasMore = (data?.length || 0) === PAGE_SIZE;
          from += PAGE_SIZE;
        }
        return allData;
      };

      // Lifecycle priority: each contact counted once in their highest stage
      const STAGE_PRIORITY: Record<string, number> = {
        disbursed: 6,
        disbursement_pending: 5,
        sanctioned: 5,
        approval_pending: 4,
        credit_assessment: 3,
        field_verification: 3,
        document_collection: 3,
        application_login: 3,
        rejected: 1,
        cancelled: 1,
        closed: 7,
      };

      // Dashboard card mapping from lifecycle priority
      const priorityToCard = (priority: number) => {
        if (priority >= 7) return "disbursed";    // closed = fully done
        if (priority >= 6) return "disbursed";
        if (priority >= 4) return "pendingApproval"; // approval_pending, sanctioned, disbursement_pending
        if (priority >= 3) return "inProgress";      // application stages
        return "other";                              // rejected, cancelled
      };

      // Execute ALL queries in parallel
      const [
        allAppsData,
        approvedAppsData,
        disbursementsData,
        pendingEMIsRes,
        overdueEMIsRes,
      ] = await Promise.all([
        // All non-draft apps with contact_id and current_stage (paginated)
        fetchAllRows(() =>
          supabase
            .from("loan_applications")
            .select("contact_id, current_stage")
            .eq("org_id", orgId)
            .neq("status", "draft")
            .not("contact_id", "is", null)
        ),

        // Total sanctioned/approved amount (paginated)
        fetchAllRows(() =>
          supabase
            .from("loan_applications")
            .select("approved_amount")
            .eq("org_id", orgId)
            .not("approved_amount", "is", null)
            .in("status", ["approved", "disbursed", "closed"])
        ),

        // Total disbursed amount (paginated)
        fetchAllRows(() =>
          supabase
            .from("loan_disbursements")
            .select("disbursement_amount, loan_applications!inner(org_id)")
            .eq("status", "completed")
            .eq("loan_applications.org_id", orgId)
        ),

        // Pending EMIs
        supabase
          .from("loan_repayment_schedule")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("status", "pending"),

        // Overdue EMIs
        supabase
          .from("loan_repayment_schedule")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .or(`status.eq.overdue,and(status.eq.pending,due_date.lt.${today})`),
      ]);

      // Deduplicate: each contact counted once at their highest lifecycle stage
      const contactHighest = new Map<string, number>();
      for (const app of allAppsData) {
        const priority = STAGE_PRIORITY[app.current_stage] || 2;
        const current = contactHighest.get(app.contact_id) || 0;
        if (priority > current) {
          contactHighest.set(app.contact_id, priority);
        }
      }

      let pendingApproval = 0;
      let inProgress = 0;
      let disbursed = 0;
      for (const priority of contactHighest.values()) {
        const card = priorityToCard(priority);
        if (card === "disbursed") disbursed++;
        else if (card === "pendingApproval") pendingApproval++;
        else if (card === "inProgress") inProgress++;
      }

      const totalSanctioned = approvedAppsData.reduce(
        (sum: number, app: any) => sum + (app.approved_amount || 0),
        0
      );

      const totalDisbursedAmount = disbursementsData.reduce(
        (sum: number, d: any) => sum + d.disbursement_amount,
        0
      );

      return {
        totalApps: contactHighest.size,
        pendingApproval,
        disbursed,
        inProgress,
        totalSanctioned,
        totalDisbursedAmount,
        pendingEMIs: pendingEMIsRes.count || 0,
        overdueEMIs: overdueEMIsRes.count || 0,
      };
    },
    enabled: !!orgId,
  });

  // Stage distribution for chart (count per current_stage)
  const { data: stageDistribution } = useQuery({
    queryKey: ["los-stage-distribution", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("current_stage")
        .eq("org_id", orgId)
        .neq("status", "draft");
      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((app: any) => {
        counts[app.current_stage] = (counts[app.current_stage] || 0) + 1;
      });

      return Object.entries(counts)
        .map(([stage, count]) => ({
          stage,
          label: STAGE_LABELS[stage] || stage,
          count,
          fill: STAGE_COLORS[stage] || "#8884d8",
        }))
        .sort((a, b) => {
          const order = Object.keys(STAGE_LABELS);
          return order.indexOf(a.stage) - order.indexOf(b.stage);
        });
    },
    enabled: !!orgId,
  });

  // Monthly disbursement trend (last 6 months)
  const { data: disbursementTrend } = useQuery({
    queryKey: ["los-disbursement-trend", orgId],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data, error } = await supabase
        .from("loan_disbursements")
        .select("disbursement_amount, disbursement_date, loan_applications!inner(org_id)")
        .eq("status", "completed")
        .eq("loan_applications.org_id", orgId)
        .gte("disbursement_date", sixMonthsAgo.toISOString().split("T")[0]);
      if (error) throw error;

      const monthly: Record<string, { amount: number; count: number }> = {};
      (data || []).forEach((d: any) => {
        const month = format(new Date(d.disbursement_date), "MMM yyyy");
        if (!monthly[month]) monthly[month] = { amount: 0, count: 0 };
        monthly[month].amount += d.disbursement_amount;
        monthly[month].count += 1;
      });

      // Generate last 6 months in order
      const result = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = format(d, "MMM yyyy");
        result.push({
          month: format(d, "MMM"),
          amount: monthly[key]?.amount || 0,
          count: monthly[key]?.count || 0,
        });
      }
      return result;
    },
    enabled: !!orgId,
  });

  // Leads by source — date-wise area chart (last 6 months, monthly)
  const { data: leadsBySourceTrend } = useQuery({
    queryKey: ["los-leads-by-source-trend", orgId],
    queryFn: async () => {
      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));

      const { data, error } = await supabase
        .from("loan_applications")
        .select("source, created_at")
        .eq("org_id", orgId)
        .neq("status", "draft")
        .gte("created_at", sixMonthsAgo.toISOString());
      if (error) throw error;

      // Collect all unique sources
      const sourceSet = new Set<string>();
      const monthlyBySource: Record<string, Record<string, number>> = {};

      (data || []).forEach((app: any) => {
        const src = app.source || "unknown";
        sourceSet.add(src);
        const month = format(new Date(app.created_at), "MMM yyyy");
        if (!monthlyBySource[month]) monthlyBySource[month] = {};
        monthlyBySource[month][src] = (monthlyBySource[month][src] || 0) + 1;
      });

      // Generate last 6 months in order
      const months = eachMonthOfInterval({
        start: sixMonthsAgo,
        end: endOfMonth(new Date()),
      });

      const sources = Array.from(sourceSet);
      const result = months.map((m) => {
        const key = format(m, "MMM yyyy");
        const row: Record<string, any> = { month: format(m, "MMM") };
        sources.forEach((src) => {
          row[src] = monthlyBySource[key]?.[src] || 0;
        });
        return row;
      });

      return { data: result, sources };
    },
    enabled: !!orgId,
  });

  // Collections cash flow — past actuals + future projections (12 months window)
  const { data: cashFlowData } = useQuery({
    queryKey: ["los-cashflow", orgId],
    queryFn: async () => {
      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
      const sixMonthsAhead = endOfMonth(addMonths(new Date(), 6));

      // Fetch all EMIs in the 12-month window
      const { data, error } = await supabase
        .from("loan_repayment_schedule")
        .select("due_date, total_emi, amount_paid, payment_date, status, principal_amount, interest_amount, late_fee")
        .eq("org_id", orgId)
        .gte("due_date", sixMonthsAgo.toISOString().split("T")[0])
        .lte("due_date", sixMonthsAhead.toISOString().split("T")[0]);
      if (error) throw error;

      const today = new Date();
      const months = eachMonthOfInterval({
        start: sixMonthsAgo,
        end: endOfMonth(addMonths(today, 6)),
      });

      const monthlyData = months.map((m) => {
        const key = format(m, "yyyy-MM");
        const monthEmis = (data || []).filter((e: any) => e.due_date.startsWith(key));
        const isPast = m <= startOfMonth(today);
        const isCurrent = format(m, "yyyy-MM") === format(today, "yyyy-MM");

        const expected = monthEmis.reduce((s: number, e: any) => s + (e.total_emi || 0), 0);
        const collected = monthEmis.reduce((s: number, e: any) => s + (e.amount_paid || 0), 0);
        const principal = monthEmis.reduce((s: number, e: any) => s + (e.principal_amount || 0), 0);
        const interest = monthEmis.reduce((s: number, e: any) => s + (e.interest_amount || 0), 0);
        const overdue = monthEmis
          .filter((e: any) => e.status === "overdue" || (e.status === "pending" && new Date(e.due_date) < today))
          .reduce((s: number, e: any) => s + (e.total_emi || 0) - (e.amount_paid || 0), 0);

        return {
          month: format(m, "MMM"),
          fullMonth: format(m, "MMM yyyy"),
          expected,
          collected: (isPast || isCurrent) ? collected : null,
          projected: (!isPast || isCurrent) ? expected : null,
          principal,
          interest,
          overdue: (isPast || isCurrent) ? overdue : null,
        };
      });

      // Summary stats
      const allEmis = data || [];
      const totalExpected = allEmis
        .filter((e: any) => new Date(e.due_date) <= today)
        .reduce((s: number, e: any) => s + (e.total_emi || 0), 0);
      const totalCollected = allEmis
        .filter((e: any) => new Date(e.due_date) <= today)
        .reduce((s: number, e: any) => s + (e.amount_paid || 0), 0);
      const totalOverdue = allEmis
        .filter((e: any) => (e.status === "overdue" || (e.status === "pending" && new Date(e.due_date) < today)))
        .reduce((s: number, e: any) => s + (e.total_emi || 0) - (e.amount_paid || 0), 0);
      const next3MonthsProjected = allEmis
        .filter((e: any) => {
          const d = new Date(e.due_date);
          return d > today && d <= addMonths(today, 3);
        })
        .reduce((s: number, e: any) => s + (e.total_emi || 0), 0);
      const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

      return {
        monthly: monthlyData,
        summary: { totalExpected, totalCollected, totalOverdue, next3MonthsProjected, collectionRate },
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

        {/* Leads by Source — full width area chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads by Source</CardTitle>
            <CardDescription>Monthly application volume by source</CardDescription>
          </CardHeader>
          <CardContent>
            {leadsBySourceTrend && leadsBySourceTrend.data.length > 0 && leadsBySourceTrend.sources.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={leadsBySourceTrend.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
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
                      stroke={SOURCE_COLORS[src] || "#8884d8"}
                      fill={SOURCE_COLORS[src] || "#8884d8"}
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
              <CardDescription>Last 6 months disbursement volume</CardDescription>
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
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
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
              <CardDescription>Past 6 months collections and next 6 months projected EMIs</CardDescription>
            </CardHeader>
            <CardContent>
              {cashFlowData?.monthly && cashFlowData.monthly.some(d => (d.expected || 0) > 0) ? (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={cashFlowData.monthly}>
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
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
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
                        const item = cashFlowData.monthly.find(d => d.month === label);
                        return item?.fullMonth || label;
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
