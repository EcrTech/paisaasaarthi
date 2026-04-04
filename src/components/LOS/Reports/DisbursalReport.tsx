import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
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

interface DisbursalRow {
  loanNo: string;
  name: string;
  state: string;
  panCard: string;
  loanAmount: number;
  netDisbursement: number;
  repayDate: string;
  tenure: number;
  roi: number;
  disbursalReferenceNo: string;
  disbursalDate: string;
  processingFee: number;
  gstFee: number;
}

interface DisbursalReportProps {
  fromDate: Date;
  toDate: Date;
}

export default function DisbursalReport({ fromDate, toDate }: DisbursalReportProps) {
  const { orgId } = useOrgContext();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["disbursal-report", orgId, format(fromDate, "yyyy-MM-dd"), format(toDate, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!orgId) return [];

      // Fetch disbursements within date range
      const { data: disbursements, error } = await supabase
        .from("loan_disbursements")
        .select(`
          id,
          disbursement_amount,
          disbursement_date,
          utr_number,
          loan_application_id,
          loan_applications:loan_application_id(
            loan_id,
            tenure_days,
            contact_id,
            loan_applicants(first_name, last_name, pan_number, applicant_type),
            loan_sanctions(
              sanctioned_amount,
              sanctioned_rate,
              sanctioned_tenure_days,
              processing_fee,
              gst_amount,
              net_disbursement_amount
            ),
            loan_repayment_schedule(due_date, emi_number)
          )
        `)
        .eq("org_id", orgId)
        .gte("disbursement_date", format(fromDate, "yyyy-MM-dd"))
        .lte("disbursement_date", format(toDate, "yyyy-MM-dd"))
        .order("disbursement_date", { ascending: false });

      if (error) throw error;
      if (!disbursements?.length) return [];

      // Collect unique contact_ids for state lookup
      const contactIds = [...new Set(
        disbursements
          .map((d: any) => d.loan_applications?.contact_id)
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

      const result: DisbursalRow[] = disbursements.map((d: any) => {
        const app = d.loan_applications;
        const primaryApplicant = app?.loan_applicants?.find(
          (a: any) => a.applicant_type === "primary"
        ) || app?.loan_applicants?.[0];

        const sanction = Array.isArray(app?.loan_sanctions)
          ? app.loan_sanctions[0]
          : app?.loan_sanctions;

        // Find the repay date (latest EMI due_date)
        const schedules = app?.loan_repayment_schedule || [];
        const repayDate = schedules.length > 0
          ? schedules.reduce((latest: any, s: any) =>
              !latest || new Date(s.due_date) > new Date(latest.due_date) ? s : latest
            , null)?.due_date
          : null;

        const sanctionedAmount = sanction?.sanctioned_amount || d.disbursement_amount || 0;
        const processingFee = sanction?.processing_fee || 0;
        const gstFee = sanction?.gst_amount || 0;
        const netDisbursement = sanction?.net_disbursement_amount || d.disbursement_amount || (sanctionedAmount - processingFee - gstFee);

        return {
          loanNo: app?.loan_id || "",
          name: primaryApplicant
            ? `${primaryApplicant.first_name} ${primaryApplicant.last_name || ""}`.trim()
            : "",
          state: contactStateMap[app?.contact_id] || "",
          panCard: primaryApplicant?.pan_number || "",
          loanAmount: sanctionedAmount,
          netDisbursement,
          repayDate: repayDate
            ? format(new Date(repayDate + "T00:00:00"), "dd-MM-yyyy")
            : "",
          tenure: sanction?.sanctioned_tenure_days || app?.tenure_days || 0,
          roi: sanction?.sanctioned_rate || 0,
          disbursalReferenceNo: d.utr_number || "",
          disbursalDate: d.disbursement_date
            ? format(new Date(d.disbursement_date + "T00:00:00"), "dd-MM-yyyy")
            : "",
          processingFee,
          gstFee,
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
      "PAN Card": r.panCard,
      "Loan Amount": r.loanAmount,
      "Processing Fee": r.processingFee,
      "GST Fee": r.gstFee,
      "Net Disbursement": r.netDisbursement,
      "Repay Date": r.repayDate,
      "Tenure": r.tenure,
      "ROI": r.roi,
      "Disbursal Reference No": r.disbursalReferenceNo,
      "Disbursal Date": r.disbursalDate,
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws["!cols"] = [
      { wch: 14 }, // Loan No
      { wch: 28 }, // Name
      { wch: 16 }, // State
      { wch: 14 }, // PAN Card
      { wch: 14 }, // Loan Amount
      { wch: 16 }, // Processing Fee
      { wch: 12 }, // GST Fee
      { wch: 16 }, // Net Disbursement
      { wch: 14 }, // Repay Date
      { wch: 10 }, // Tenure
      { wch: 8 },  // ROI
      { wch: 22 }, // Disbursal Reference No
      { wch: 16 }, // Disbursal Date
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet 1");

    const filename = `Digi Disbursal Report ${format(new Date(), "dd.MM.yy")}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success(`Downloaded disbursal report with ${rows.length} records`);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);

  const totalDisbursed = rows.reduce((s, r) => s + r.loanAmount, 0);
  const totalPF = rows.reduce((s, r) => s + r.processingFee, 0);
  const totalGST = rows.reduce((s, r) => s + r.gstFee, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Disbursals</p>
          <p className="text-xl font-bold">{rows.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Loan Amount</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalDisbursed)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Processing Fee</p>
          <p className="text-xl font-bold text-blue-600">{formatCurrency(totalPF)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total GST</p>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(totalGST)}</p>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Disbursal Records ({rows.length})
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
              No disbursal records found for selected date range
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>PAN</TableHead>
                    <TableHead className="text-right">Loan Amount</TableHead>
                    <TableHead>Repay Date</TableHead>
                    <TableHead className="text-right">Tenure</TableHead>
                    <TableHead className="text-right">ROI</TableHead>
                    <TableHead>Disbursal Ref No</TableHead>
                    <TableHead>Disbursal Date</TableHead>
                    <TableHead className="text-right">Processing Fee</TableHead>
                    <TableHead className="text-right">GST Fee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm text-primary">{row.loanNo}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.state}</TableCell>
                      <TableCell className="font-mono text-sm">{row.panCard}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.loanAmount)}</TableCell>
                      <TableCell>{row.repayDate}</TableCell>
                      <TableCell className="text-right">{row.tenure}</TableCell>
                      <TableCell className="text-right">{row.roi}</TableCell>
                      <TableCell className="font-mono text-sm">{row.disbursalReferenceNo}</TableCell>
                      <TableCell>{row.disbursalDate}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.processingFee)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.gstFee)}</TableCell>
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
