import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays } from "date-fns";

interface StaffMetrics {
  user_id: string;
  user_name: string;
  leads_assigned: number;
  leads_amount: number;
  applications_in_progress: number;
  in_progress_amount: number;
  approvals: number;
  approvals_amount: number;
  sanctions: number;
  sanctions_amount: number;
  disbursements: number;
  total_disbursed_amount: number;
  collection_rate: number;
}

interface StaffPerformanceDashboardProps {
  fromDate: Date;
  toDate: Date;
  agentOnly?: boolean;
}

export default function StaffPerformanceDashboard({ fromDate, toDate, agentOnly }: StaffPerformanceDashboardProps) {
  const { orgId } = useOrgContext();

  // Fetch all loan applications with assigned_to for the org
  const { data: applications = [], isLoading: appsLoading } = useQuery({
    queryKey: ["staff-performance-apps", orgId, fromDate.toISOString(), toDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("id, contact_id, assigned_to, current_stage, status, requested_amount, approved_amount, created_at")
        .eq("org_id", orgId!)
        .neq("status", "draft")
        .gte("created_at", fromDate.toISOString())
        .lte("created_at", toDate.toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch all disbursements
  const { data: disbursements = [], isLoading: disbLoading } = useQuery({
    queryKey: ["staff-performance-disb", orgId, fromDate.toISOString(), toDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_disbursements")
        .select("id, loan_application_id, disbursement_amount, status, created_at")
        .eq("status", "completed")
        .gte("created_at", fromDate.toISOString())
        .lte("created_at", toDate.toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  // When agentOnly, fetch user IDs with agent roles
  const { data: agentUserIds } = useQuery({
    queryKey: ["agent-role-users", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("org_id", orgId!)
        .in("role", ["sales_agent", "support_agent"]);
      if (error) throw error;
      return (data || []).map((r: any) => r.user_id);
    },
    enabled: !!orgId && !!agentOnly,
  });

  // Fetch assigned user profiles
  const assignedUserIds = [...new Set(applications.filter((a) => a.assigned_to).map((a) => a.assigned_to))];
  const filteredUserIds = agentOnly && agentUserIds
    ? assignedUserIds.filter((id) => agentUserIds.includes(id as string))
    : assignedUserIds;
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["staff-profiles", filteredUserIds],
    queryFn: async () => {
      if (filteredUserIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", filteredUserIds as string[]);
      if (error) throw error;
      return data || [];
    },
    enabled: filteredUserIds.length > 0 && (!agentOnly || !!agentUserIds),
  });

  // Fetch collection stats
  const { data: collections = [], isLoading: collLoading } = useQuery({
    queryKey: ["staff-performance-coll", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayment_schedule")
        .select("loan_application_id, total_emi, amount_paid, status")
        .eq("org_id", orgId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const isLoading = appsLoading || disbLoading || profilesLoading || collLoading;

  const staffMetrics: StaffMetrics[] = useMemo(() => {
    const profileMap: Record<string, string> = {};
    profiles.forEach((p) => {
      profileMap[p.id] = `${p.first_name} ${p.last_name || ""}`.trim();
    });

    // Build disbursement map by application_id
    const disbMap: Record<string, number> = {};
    disbursements.forEach((d: any) => {
      disbMap[d.loan_application_id] = (disbMap[d.loan_application_id] || 0) + d.disbursement_amount;
    });

    // Build collection rate by application_id
    const collectionMap: Record<string, { expected: number; collected: number }> = {};
    collections.forEach((c: any) => {
      if (!collectionMap[c.loan_application_id]) {
        collectionMap[c.loan_application_id] = { expected: 0, collected: 0 };
      }
      collectionMap[c.loan_application_id].expected += c.total_emi || 0;
      collectionMap[c.loan_application_id].collected += c.amount_paid || 0;
    });

    // Lifecycle priority for deduplication: each contact counted once at highest stage
    const STAGE_PRIORITY: Record<string, number> = {
      disbursed: 6, closed: 7,
      disbursement_pending: 5, sanctioned: 5,
      approval_pending: 4,
      credit_assessment: 3, field_verification: 3, document_collection: 3, application_login: 3, assessment: 3,
      rejected: 1, cancelled: 1,
    };

    const stageToCategory = (priority: number) => {
      if (priority >= 6) return "disbursed";
      if (priority >= 5) return "sanctioned";
      if (priority >= 4) return "approved";
      if (priority >= 3) return "in_progress";
      return "other";
    };

    // Group by assigned_to, then deduplicate contacts within each staff member
    // Step 1: For each staff+contact pair, find the highest lifecycle stage
    const staffContactHighest: Record<string, Map<string, { priority: number; appId: string; amount: number }>> = {};

    applications.forEach((app: any) => {
      const userId = app.assigned_to;
      const contactId = app.contact_id;
      if (!userId || !contactId) return;

      if (!staffContactHighest[userId]) {
        staffContactHighest[userId] = new Map();
      }

      const priority = STAGE_PRIORITY[app.current_stage] || 2;
      const current = staffContactHighest[userId].get(contactId);
      if (!current || priority > current.priority) {
        staffContactHighest[userId].set(contactId, {
          priority,
          appId: app.id,
          amount: disbMap[app.id] || app.approved_amount || app.requested_amount || 0,
        });
      }
    });

    // Step 2: Build staff metrics from deduplicated contacts
    const grouped: Record<string, StaffMetrics> = {};

    for (const [userId, contactMap] of Object.entries(staffContactHighest)) {
      grouped[userId] = {
        user_id: userId,
        user_name: profileMap[userId] || "Unknown",
        leads_assigned: contactMap.size,
        leads_amount: 0,
        applications_in_progress: 0,
        in_progress_amount: 0,
        approvals: 0,
        approvals_amount: 0,
        sanctions: 0,
        sanctions_amount: 0,
        disbursements: 0,
        total_disbursed_amount: 0,
        collection_rate: 0,
      };

      for (const { priority, amount } of contactMap.values()) {
        const category = stageToCategory(priority);
        grouped[userId].leads_amount += amount;
        if (category === "in_progress") { grouped[userId].applications_in_progress++; grouped[userId].in_progress_amount += amount; }
        if (category === "approved") { grouped[userId].approvals++; grouped[userId].approvals_amount += amount; }
        if (category === "sanctioned") { grouped[userId].approvals++; grouped[userId].approvals_amount += amount; grouped[userId].sanctions++; grouped[userId].sanctions_amount += amount; }
        if (category === "disbursed") { grouped[userId].approvals++; grouped[userId].approvals_amount += amount; grouped[userId].sanctions++; grouped[userId].sanctions_amount += amount; grouped[userId].disbursements++; grouped[userId].total_disbursed_amount += amount; }
      }
    }

    // Calculate collection rates
    Object.values(grouped).forEach((staff) => {
      const appIds = applications.filter((a: any) => a.assigned_to === staff.user_id).map((a: any) => a.id);
      let totalExpected = 0;
      let totalCollected = 0;
      appIds.forEach((id) => {
        if (collectionMap[id]) {
          totalExpected += collectionMap[id].expected;
          totalCollected += collectionMap[id].collected;
        }
      });
      staff.collection_rate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
    });

    return Object.values(grouped).sort((a, b) => b.disbursements - a.disbursements);
  }, [applications, disbursements, profiles, collections]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);

  const formatCompact = (amount: number) => {
    if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)}Cr`;
    if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
    return amount.toString();
  };

  const exportToCSV = () => {
    if (staffMetrics.length === 0) return;
    const headers = "Staff Name,Leads,In Progress,Approvals,Sanctions,Disbursements,Disbursed Amount,Collection Rate";
    const rows = staffMetrics.map((s) =>
      [s.user_name, s.leads_assigned, s.applications_in_progress, s.approvals, s.sanctions, s.disbursements, s.total_disbursed_amount, `${s.collection_rate}%`].join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff_performance_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Staff Performance — Leads to Disbursement</CardTitle>
          <CardDescription>
            {format(fromDate, "dd MMM yyyy")} — {format(toDate, "dd MMM yyyy")}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={exportToCSV} disabled={staffMetrics.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        {staffMetrics.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No staff performance data for this period
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Name</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">In Progress</TableHead>
                <TableHead className="text-right">Approvals</TableHead>
                <TableHead className="text-right">Sanctions</TableHead>
                <TableHead className="text-right">Disbursed</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Collection %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffMetrics.map((staff) => (
                <TableRow key={staff.user_id}>
                  <TableCell className="font-medium">{staff.user_name}</TableCell>
                  <TableCell className="text-right">
                    <div>{staff.leads_assigned}</div>
                    {staff.leads_amount > 0 && <div className="text-xs text-muted-foreground">{formatCompact(staff.leads_amount)}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div>{staff.applications_in_progress}</div>
                    {staff.in_progress_amount > 0 && <div className="text-xs text-muted-foreground">{formatCompact(staff.in_progress_amount)}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div>{staff.approvals}</div>
                    {staff.approvals_amount > 0 && <div className="text-xs text-muted-foreground">{formatCompact(staff.approvals_amount)}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div>{staff.sanctions}</div>
                    {staff.sanctions_amount > 0 && <div className="text-xs text-muted-foreground">{formatCompact(staff.sanctions_amount)}</div>}
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-600">
                    <div>{staff.disbursements}</div>
                    {staff.total_disbursed_amount > 0 && <div className="text-xs font-normal">{formatCompact(staff.total_disbursed_amount)}</div>}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(staff.total_disbursed_amount)}</TableCell>
                  <TableCell className="text-right">
                    <span className={staff.collection_rate >= 80 ? "text-green-600" : staff.collection_rate >= 50 ? "text-yellow-600" : "text-destructive"}>
                      {staff.collection_rate}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
