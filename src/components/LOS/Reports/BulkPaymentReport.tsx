import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { parse } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileSpreadsheet, ArrowLeft } from "lucide-react";
import { format, subDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { generateBulkPaymentExcel, type BulkPaymentRow } from "@/utils/bulkPaymentExport";
import { toast } from "sonner";

export default function BulkPaymentReport() {
  const { orgId } = useOrgContext();
  const navigate = useNavigate();
  const [fromDateObj, setFromDateObj] = useState<Date>(subDays(new Date(), 30));
  const [toDateObj, setToDateObj] = useState<Date>(new Date());
  const fromDate = format(fromDateObj, "yyyy-MM-dd");
  const toDate = format(toDateObj, "yyyy-MM-dd");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [debitAccountNumber, setDebitAccountNumber] = useState("");

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["bulk-payment-report", orgId, fromDate, toDate, stageFilter],
    queryFn: async () => {
      if (!orgId) return [];

      let query = supabase
        .from("loan_applications")
        .select(`
          id,
          application_number,
          current_stage,
          created_at,
          loan_applicants!inner (
            id,
            first_name,
            last_name,
            bank_account_holder_name,
            bank_account_number,
            bank_ifsc_code,
            email,
            mobile,
            applicant_type
          ),
          loan_sanctions (
            sanctioned_amount,
            processing_fee,
            net_disbursement_amount
          ),
          loan_disbursements (
            payment_mode,
            disbursement_date
          )
        `)
        .eq("org_id", orgId)
        .eq("loan_applicants.applicant_type", "primary")
        .gte("created_at", `${fromDate}T00:00:00`)
        .lte("created_at", `${toDate}T23:59:59`);

      if (stageFilter === "all") {
        query = query.in("current_stage", ["sanctioned", "disbursement_pending"]);
      } else {
        query = query.eq("current_stage", stageFilter);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;

      // Decrypt mobile numbers for all primary applicants
      const apps = data || [];
      const applicantIds = apps
        .map((app: any) => app.loan_applicants?.[0]?.id)
        .filter(Boolean);

      const decryptedMap: Record<string, string> = {};
      if (applicantIds.length > 0) {
        const decryptResults = await Promise.all(
          applicantIds.map((id: string) =>
            supabase.rpc("get_applicant_decrypted", { p_applicant_id: id })
          )
        );
        decryptResults.forEach((res) => {
          const row = res.data as any;
          if (row?.id) {
            decryptedMap[row.id] = row.mobile || "";
          }
        });
      }

      return apps.map((app: any) => ({
        ...app,
        _decryptedMobile: decryptedMap[app.loan_applicants?.[0]?.id] || "",
      }));
    },
    enabled: !!orgId,
  });

  const mappedRows: BulkPaymentRow[] = records.map((app: any) => {
    const applicant = app.loan_applicants?.[0];
    const sanction = Array.isArray(app.loan_sanctions) ? app.loan_sanctions[0] : app.loan_sanctions;
    const disbursement = Array.isArray(app.loan_disbursements) ? app.loan_disbursements[0] : app.loan_disbursements;

    return {
      applicationNumber: app.application_number || "",
      beneficiaryName: applicant?.bank_account_holder_name || `${applicant?.first_name || ""} ${applicant?.last_name || ""}`.trim(),
      accountNumber: applicant?.bank_account_number || "",
      ifscCode: applicant?.bank_ifsc_code || "",
      amount: sanction?.net_disbursement_amount || (() => {
        const sanctionedAmt = sanction?.sanctioned_amount || 0;
        const procFee = sanction?.processing_fee || Math.round(sanctionedAmt * 0.10);
        const gst = Math.round(procFee * 0.18);
        return sanctionedAmt - procFee - gst;
      })(),
      paymentMode: disbursement?.payment_mode || "NEFT",
      email: applicant?.email || "",
      mobile: app._decryptedMobile || "",
    };
  });

  const handleDownload = () => {
    if (mappedRows.length === 0) {
      toast.error("No records to export");
      return;
    }
    generateBulkPaymentExcel(mappedRows, debitAccountNumber);
    toast.success(`Downloaded BLKPAY report with ${mappedRows.length} records`);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6" />
              Bulk Payment Report
            </h1>
            <p className="text-muted-foreground text-sm">
              Generate BLKPAY Excel file for bank bulk payment upload
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <Label className="text-xs">From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-40 justify-start text-left font-normal", !fromDateObj && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(fromDateObj, "dd-MM-yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={fromDateObj} onSelect={(d) => d && setFromDateObj(d)} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-40 justify-start text-left font-normal", !toDateObj && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(toDateObj, "dd-MM-yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={toDateObj} onSelect={(d) => d && setToDateObj(d)} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Stage</Label>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="all">All (Sanctioned + Pending)</SelectItem>
                     <SelectItem value="sanctioned">Sanctioned</SelectItem>
                     <SelectItem value="disbursement_pending">Disbursement Pending</SelectItem>
                     <SelectItem value="disbursed">Disbursed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Debit Account Number</Label>
                <Input
                  type="text"
                  placeholder="Company bank A/C"
                  value={debitAccountNumber}
                  onChange={(e) => setDebitAccountNumber(e.target.value)}
                  className="w-48"
                />
              </div>
              <Button onClick={handleDownload} disabled={mappedRows.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Download BLKPAY ({mappedRows.length})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Preview ({mappedRows.length} records)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : mappedRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No records found for selected filters
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Sr No</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Beneficiary Name</TableHead>
                      <TableHead>Account No</TableHead>
                      <TableHead>IFSC</TableHead>
                      <TableHead className="text-right">Net Disbursal</TableHead>
                      <TableHead>Loan ID</TableHead>
                      <TableHead>Mobile</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedRows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.paymentMode.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{row.beneficiaryName}</TableCell>
                        <TableCell className="font-mono text-sm">{row.accountNumber}</TableCell>
                        <TableCell className="font-mono text-sm">{row.ifscCode}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                        <TableCell>{row.applicationNumber}</TableCell>
                        <TableCell>{row.mobile}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
