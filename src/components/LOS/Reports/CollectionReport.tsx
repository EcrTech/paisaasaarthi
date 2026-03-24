import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CollectionRow {
  loanNo: string;
  name: string;
  state: string;
  collectedAmount: number;
  penalty: number;
  collectedMode: string;
  collectionDate: string;
  referenceNo: string;
  status: string;
  remark: string;
}

interface CollectionReportProps {
  fromDate: Date;
  toDate: Date;
}

export default function CollectionReport({ fromDate, toDate }: CollectionReportProps) {
  const { orgId } = useOrgContext();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["collection-report", orgId, fromDate.toISOString(), toDate.toISOString()],
    queryFn: async () => {
      if (!orgId) return [];

      // Fetch payments within date range with related data
      const { data: payments, error } = await supabase
        .from("loan_payments")
        .select(`
          id,
          payment_amount,
          payment_date,
          payment_method,
          transaction_reference,
          late_fee_paid,
          schedule_id,
          loan_application_id,
          loan_applications:loan_application_id(
            loan_id,
            contact_id,
            loan_applicants(first_name, last_name, applicant_type),
            loan_repayment_schedule(status, late_fee, amount_paid, total_emi)
          )
        `)
        .eq("org_id", orgId)
        .gte("payment_date", format(fromDate, "yyyy-MM-dd"))
        .lte("payment_date", format(toDate, "yyyy-MM-dd"))
        .order("payment_date", { ascending: false });

      if (error) throw error;
      if (!payments?.length) return [];

      // Collect unique contact_ids to fetch state
      const contactIds = [...new Set(
        payments
          .map((p: any) => p.loan_applications?.contact_id)
          .filter(Boolean)
      )];

      let contactStateMap: Record<string, string> = {};
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, state")
          .in("id", contactIds);
        if (contacts) {
          contactStateMap = Object.fromEntries(
            contacts.map((c: any) => [c.id, c.state || ""])
          );
        }
      }

      const result: CollectionRow[] = payments.map((p: any) => {
        const app = p.loan_applications;
        const primaryApplicant = app?.loan_applicants?.find(
          (a: any) => a.applicant_type === "primary"
        ) || app?.loan_applicants?.[0];

        // Determine loan status from repayment schedule
        const schedules = app?.loan_repayment_schedule || [];
        const allPaid = schedules.length > 0 && schedules.every(
          (s: any) => s.status === "paid" || s.status === "settled"
        );
        const hasPartPayment = schedules.some(
          (s: any) => (s.amount_paid || 0) > 0 && (s.amount_paid || 0) < s.total_emi
        );

        let status = "Part_Payment";
        let remark = "Part Payment";
        if (allPaid) {
          status = "Closed";
          remark = "Closed";
        }

        return {
          loanNo: app?.loan_id || "",
          name: primaryApplicant
            ? `${primaryApplicant.first_name} ${primaryApplicant.last_name || ""}`.trim()
            : "",
          state: contactStateMap[app?.contact_id] || "",
          collectedAmount: p.payment_amount || 0,
          penalty: p.late_fee_paid || 0,
          collectedMode: p.payment_method || "",
          collectionDate: p.payment_date
            ? format(new Date(p.payment_date), "dd-MM-yyyy")
            : "",
          referenceNo: p.transaction_reference || "",
          status,
          remark,
        };
      });

      return result;
    },
    enabled: !!orgId,
  });

  const handleDownload = () => {
    if (rows.length === 0) {
      toast.error("No records to export");
      return;
    }

    const sheetData = rows.map((r) => ({
      "Loan No": r.loanNo,
      "Name": r.name,
      "State": r.state,
      "Collected Amount": r.collectedAmount,
      "Penalty": r.penalty,
      "Collected Mode": r.collectedMode,
      "Collection Date": r.collectionDate,
      "Reference No": r.referenceNo,
      "Status": r.status,
      "Remark": r.remark,
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws["!cols"] = [
      { wch: 14 }, // Loan No
      { wch: 28 }, // Name
      { wch: 16 }, // State
      { wch: 18 }, // Collected Amount
      { wch: 10 }, // Penalty
      { wch: 16 }, // Collected Mode
      { wch: 16 }, // Collection Date
      { wch: 20 }, // Reference No
      { wch: 14 }, // Status
      { wch: 16 }, // Remark
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet 1");

    const filename = `Digi collection_report ${format(new Date(), "dd.MM.yy")}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success(`Downloaded collection report with ${rows.length} records`);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);

  const totalCollected = rows.reduce((s, r) => s + r.collectedAmount, 0);
  const totalPenalty = rows.reduce((s, r) => s + r.penalty, 0);
  const closedCount = rows.filter((r) => r.status === "Closed").length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Records</p>
          <p className="text-xl font-bold">{rows.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Collected</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalCollected)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Penalty</p>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(totalPenalty)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Closed Loans</p>
          <p className="text-xl font-bold text-primary">{closedCount}</p>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Collection Records ({rows.length})
          </CardTitle>
          <Button size="sm" onClick={handleDownload} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Download Excel
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No collection records found for selected date range
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Collected Amount</TableHead>
                    <TableHead className="text-right">Penalty</TableHead>
                    <TableHead>Collected Mode</TableHead>
                    <TableHead>Collection Date</TableHead>
                    <TableHead>Reference No</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm text-primary">{row.loanNo}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.state}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.collectedAmount)}</TableCell>
                      <TableCell className="text-right">{row.penalty}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.collectedMode}</Badge>
                      </TableCell>
                      <TableCell>{row.collectionDate}</TableCell>
                      <TableCell className="font-mono text-sm">{row.referenceNo}</TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            row.status === "Closed"
                              ? "bg-green-500"
                              : "bg-yellow-500"
                          )}
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.remark}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
