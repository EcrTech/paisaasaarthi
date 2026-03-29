import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

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

  const { data: staffMetrics = [], isLoading } = useQuery({
    queryKey: ["staff-performance", orgId, fromDate.toISOString(), toDate.toISOString(), agentOnly],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_staff_performance", {
        p_org_id: orgId!,
        p_from_date: fromDate.toISOString(),
        p_to_date: toDate.toISOString(),
        p_agent_only: !!agentOnly,
      });
      if (error) throw error;
      return (data as StaffMetrics[]) || [];
    },
    enabled: !!orgId,
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);

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
                    {staff.leads_amount > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(staff.leads_amount)}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div>{staff.applications_in_progress}</div>
                    {staff.in_progress_amount > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(staff.in_progress_amount)}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div>{staff.approvals}</div>
                    {staff.approvals_amount > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(staff.approvals_amount)}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div>{staff.sanctions}</div>
                    {staff.sanctions_amount > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(staff.sanctions_amount)}</div>}
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-600">
                    <div>{staff.disbursements}</div>
                    {staff.total_disbursed_amount > 0 && <div className="text-xs font-normal">{formatCurrency(staff.total_disbursed_amount)}</div>}
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
