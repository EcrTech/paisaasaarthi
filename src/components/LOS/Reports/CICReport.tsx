import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, FileText } from "lucide-react";
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

// ─── CIC constants ─────────────────────────────────────────────────────────
const CIC_COLUMNS = [
  "Consumer Name", "Date of Birth", "Gender", "Income Tax ID Number",
  "Passport Number", "Passport Issue Date", "Passport Expiry Date",
  "Voter ID Number", "Driving License Number", "Driving License Issue Date",
  "Driving License Expiry Date", "Ration Card Number", "Universal ID Number",
  "Additional ID #1", "Additional ID #2",
  "Telephone No.Mobile", "Telephone No.Residence", "Telephone No.Office",
  "Extension Office", "Telephone No.Other", "Extension Other",
  "Email ID 1", "Email ID 2",
  "Address 1", "State Code 1", "PIN Code 1", "Address Category 1", "Residence Code 1",
  "Address 2", "State Code 2", "PIN Code 2", "Address Category 2", "Residence Code 2",
  "Current/New Member Code", "Current/New Member Short Name", "Curr/New Account No",
  "Account Type", "Ownership Indicator",
  "Date Opened/Disbursed", "Date of Last Payment", "Date Closed", "Date Reported",
  "High Credit/Sanctioned Amt", "Current Balance", "Amt Overdue", "No of Days Past Due",
  "Old Mbr Code", "Old Mbr Short Name", "Old Acc No", "Old Acc Type",
  "Old Ownership Indicator", "Suit Filed / Wilful Default",
  "Credit Facility Status", "Asset Classification",
  "Value of Collateral", "Type of Collateral",
  "Credit Limit", "Cash Limit", "Rate of Interest", "RepaymentTenure",
  "EMI Amount",
  "Written- off Amount (Total)", "Written- off Principal Amount", "Settlement Amt",
  "Payment Frequency", "Actual Payment Amt",
  "Occupation Code", "Income", "Net/Gross Income Indicator",
  "Monthly/Annual Income Indicator", "CKYC", "NREGA Card Number",
];

// ─── Derivation helpers ─────────────────────────────────────────────────────
function fmtDate(val: string | null | undefined): string | null {
  if (!val) return null;
  try {
    return format(new Date(val + (val.length === 10 ? "T00:00:00" : "")), "dd-MM-yyyy");
  } catch {
    return val;
  }
}

function fullName(a: any): string {
  return [a.first_name, a.middle_name, a.last_name].filter(Boolean).join(" ").trim();
}

function flatAddress(addr: any): string | null {
  if (!addr) return null;
  const parts = [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean);
  return parts.join(", ") || null;
}

function getDPD(schedules: any[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let max = 0;
  for (const s of schedules) {
    if (s.status !== "paid" && s.due_date) {
      const due = new Date(s.due_date + "T00:00:00");
      if (today > due) {
        max = Math.max(max, Math.floor((today.getTime() - due.getTime()) / 86400000));
      }
    }
  }
  return max;
}

function getAmtOverdue(schedules: any[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let total = 0;
  for (const s of schedules) {
    if (["pending", "overdue", "partially_paid"].includes(s.status) && s.due_date) {
      const due = new Date(s.due_date + "T00:00:00");
      if (today > due) {
        total += Math.max(0, (s.total_emi || 0) - (s.amount_paid || 0));
      }
    }
  }
  return total;
}

function getCFStatus(schedules: any[]): string {
  if (schedules.length > 0 && schedules.every((s) => s.status === "paid")) return "Closed";
  return getDPD(schedules) > 90 ? "NPA" : "Standard";
}

function getAssetClass(schedules: any[]): string {
  if (schedules.length > 0 && schedules.every((s) => s.status === "paid")) return "Standard";
  const dpd = getDPD(schedules);
  if (dpd <= 90) return "Standard";
  if (dpd <= 180) return "Sub-Standard";
  if (dpd <= 360) return "Doubtful 1";
  if (dpd <= 540) return "Doubtful 2";
  if (dpd <= 720) return "Doubtful 3";
  return "Loss";
}

function getDateClosed(schedules: any[]): string | null {
  if (schedules.length > 0 && schedules.every((s) => s.status === "paid")) {
    const dates = schedules.map((s) => s.payment_date).filter(Boolean);
    if (dates.length) return fmtDate(dates.sort().at(-1));
  }
  return null;
}

function getCurrentBalance(sanctionedAmount: number, payments: any[]): number {
  const totalPaid = payments.reduce((s: number, p: any) => s + (p.principal_paid || 0), 0);
  return Math.max(0, sanctionedAmount - totalPaid);
}

function mapOccupation(empType: string | null): string {
  const t = (empType || "").toLowerCase();
  if (t === "salaried") return "Salaried";
  if (["self_employed", "business"].includes(t)) return "Self Employed";
  return "Others";
}

// ─── Row mapper (produces the 72 CIC fields) ───────────────────────────────
function mapToCIC(
  app: any,
  applicant: any,
  employment: any,
  sanction: any,
  disbursement: any,
  schedules: any[],
  payments: any[],
  lastPayment: any,
  todayStr: string,
): (string | number | null)[] {
  const currAddr = applicant.current_address || {};
  const permAddr = applicant.permanent_address || null;
  const sanctionedAmt = sanction?.sanctioned_amount || 0;
  const isClosed = getCFStatus(schedules) === "Closed";

  const currBalance = isClosed ? 0 : getCurrentBalance(sanctionedAmt, payments);
  const amtOverdue  = isClosed ? 0 : Math.round(getAmtOverdue(schedules) * 100) / 100;
  const dpd         = isClosed ? 0 : getDPD(schedules);
  const cfStatus    = getCFStatus(schedules);
  const assetClass  = getAssetClass(schedules);
  const dateClosed  = getDateClosed(schedules);
  const firstSched  = schedules[0];
  const accountNo   = app.loan_id || app.application_number;

  return [
    // 1–15 Consumer / KYC
    fullName(applicant),
    fmtDate(applicant.dob),
    applicant.gender,
    applicant.pan_number,
    null, null, null, null, null, null, null, null,
    applicant.aadhaar_number,
    null, null,
    // 16–23 Contact
    applicant.mobile,
    null, null, null,
    applicant.alternate_mobile,
    null,
    applicant.email,
    null,
    // 24–33 Address
    flatAddress(currAddr),
    currAddr.state || null,
    currAddr.pincode || null,
    "Current",
    applicant.residence_type || null,
    permAddr ? flatAddress(permAddr) : null,
    permAddr ? (permAddr.state || null) : null,
    permAddr ? (permAddr.pincode || null) : null,
    permAddr ? "Permanent" : null,
    null,
    // 34–38 Member / Account
    "",  // CIC_MEMBER_CODE — fill before submission
    "",  // CIC_MEMBER_SHORT_NAME — fill before submission
    accountNo,
    "Personal Loan",
    "Individual",
    // 39–42 Key dates
    fmtDate(disbursement?.disbursement_date),
    lastPayment ? fmtDate(lastPayment.payment_date) : null,
    dateClosed,
    todayStr,
    // 43–46 Balance
    sanctionedAmt || null,
    Math.round(currBalance * 100) / 100,
    amtOverdue,
    dpd,
    // 47–54 Old account / misc
    null, null, null, null, null, null,
    cfStatus,
    assetClass,
    // 55–58 Collateral
    null, null,
    sanctionedAmt || null,
    sanctionedAmt || null,
    // 59–65 Terms
    sanction?.sanctioned_rate || null,
    sanction?.sanctioned_tenure_days || null,
    firstSched?.total_emi || null,
    null, null, null,
    // 66–72 Payment / Income
    "Monthly",
    lastPayment ? lastPayment.payment_amount : null,
    mapOccupation(employment?.employment_type),
    employment?.gross_monthly_salary || null,
    "G",
    "M",
    null, null,
  ];
}

// ─── Preview row type ───────────────────────────────────────────────────────
interface PreviewRow {
  accountNo: string;
  name: string;
  pan: string;
  mobile: string;
  disbursementDate: string;
  sanctionedAmt: number;
  currentBalance: number;
  amtOverdue: number;
  dpd: number;
  cfStatus: string;
  cicRow: (string | number | null)[];
}

// ─── Props ──────────────────────────────────────────────────────────────────
interface CICReportProps {
  fromDate: Date;
  toDate: Date;
}

export default function CICReport({ fromDate, toDate }: CICReportProps) {
  const { orgId } = useOrgContext();
  const todayStr = format(new Date(), "dd-MM-yyyy");

  const { data: rows = [], isLoading } = useQuery<PreviewRow[]>({
    queryKey: ["cic-report", orgId, format(fromDate, "yyyy-MM-dd"), format(toDate, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!orgId) return [];

      // 1. Disbursements in range
      const { data: disbursements, error: disbErr } = await supabase
        .from("loan_disbursements")
        .select(`
          id,
          disbursement_date,
          loan_application_id,
          loan_applications:loan_application_id(
            id,
            loan_id,
            application_number,
            loan_applicants(
              id,
              applicant_type,
              first_name, middle_name, last_name,
              dob, gender, pan_number, aadhaar_number,
              mobile, alternate_mobile, email,
              current_address, permanent_address, residence_type,
              loan_employment_details(
                employment_type, gross_monthly_salary, net_monthly_salary
              )
            ),
            loan_sanctions(
              sanctioned_amount, sanctioned_rate, sanctioned_tenure_days
            ),
            loan_repayment_schedule(
              emi_number, due_date, total_emi, outstanding_principal,
              status, payment_date, amount_paid
            ),
            loan_payments(
              payment_date, payment_amount, principal_paid
            )
          )
        `)
        .eq("org_id", orgId)
        .eq("status", "completed")
        .gte("disbursement_date", format(fromDate, "yyyy-MM-dd"))
        .lte("disbursement_date", format(toDate, "yyyy-MM-dd"))
        .order("disbursement_date", { ascending: false });

      if (disbErr) throw disbErr;
      if (!disbursements?.length) return [];

      const result: PreviewRow[] = [];

      for (const disb of disbursements as any[]) {
        const app = disb.loan_applications;
        if (!app) continue;

        const applicant = (app.loan_applicants as any[])?.find(
          (a: any) => a.applicant_type === "primary"
        ) ?? app.loan_applicants?.[0];
        if (!applicant) continue;

        const employment = applicant.loan_employment_details?.[0] || null;

        const sanction = Array.isArray(app.loan_sanctions)
          ? app.loan_sanctions[0]
          : app.loan_sanctions || null;

        const schedules: any[] = (app.loan_repayment_schedule || []).sort(
          (a: any, b: any) => (a.emi_number || 0) - (b.emi_number || 0)
        );

        const payments: any[] = (app.loan_payments || []).sort(
          (a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
        );
        const lastPayment = payments[0] || null;

        const isClosed = getCFStatus(schedules) === "Closed";
        const sanctionedAmt = sanction?.sanctioned_amount || 0;

        result.push({
          accountNo: app.loan_id || app.application_number || "",
          name: fullName(applicant),
          pan: applicant.pan_number || "",
          mobile: applicant.mobile || "",
          disbursementDate: disb.disbursement_date
            ? format(new Date(disb.disbursement_date + "T00:00:00"), "dd-MM-yyyy")
            : "",
          sanctionedAmt,
          currentBalance: isClosed ? 0 : getCurrentBalance(sanctionedAmt, payments),
          amtOverdue: isClosed ? 0 : getAmtOverdue(schedules),
          dpd: isClosed ? 0 : getDPD(schedules),
          cfStatus: getCFStatus(schedules),
          cicRow: mapToCIC(app, applicant, employment, sanction, disb, schedules, payments, lastPayment, todayStr),
        });
      }

      return result;
    },
    enabled: !!orgId,
  });

  const handleDownload = () => {
    if (rows.length === 0) {
      toast.error("No records to export");
      return;
    }

    const sheetData = rows.map((r) => {
      const obj: Record<string, string | number | null> = {};
      CIC_COLUMNS.forEach((col, i) => {
        obj[col] = r.cicRow[i] ?? null;
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(sheetData, { header: CIC_COLUMNS });

    // Column widths
    ws["!cols"] = CIC_COLUMNS.map((col) => ({
      wch: Math.min(Math.max(col.length + 2, 12), 32),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CIC Report");

    const filename = `CIC_Report_${format(new Date(), "ddMMyyyy")}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success(`Downloaded CIC report with ${rows.length} records`);
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

  const totalLoans     = rows.length;
  const totalSanctioned = rows.reduce((s, r) => s + r.sanctionedAmt, 0);
  const totalBalance   = rows.reduce((s, r) => s + r.currentBalance, 0);
  const totalOverdue   = rows.reduce((s, r) => s + r.amtOverdue, 0);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Accounts</p>
          <p className="text-xl font-bold">{totalLoans}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Sanctioned</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalSanctioned)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Current Outstanding</p>
          <p className="text-xl font-bold text-blue-600">{formatCurrency(totalBalance)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Amount Overdue</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalOverdue)}</p>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              CIC Report Preview ({rows.length} accounts)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Download exports all 72 CIC fields in the required format
            </p>
          </div>
          <Button size="sm" onClick={handleDownload} disabled={rows.length === 0 || isLoading}>
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
              No completed disbursements found for selected date range
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>PAN</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Disbursal Date</TableHead>
                    <TableHead className="text-right">Sanctioned Amt</TableHead>
                    <TableHead className="text-right">Current Balance</TableHead>
                    <TableHead className="text-right">Amt Overdue</TableHead>
                    <TableHead className="text-right">DPD</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm text-primary">{row.accountNo}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="font-mono text-sm">{row.pan}</TableCell>
                      <TableCell>{row.mobile}</TableCell>
                      <TableCell>{row.disbursementDate}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.sanctionedAmt)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.currentBalance)}</TableCell>
                      <TableCell className="text-right">
                        {row.amtOverdue > 0 ? (
                          <span className="text-red-600 font-medium">{formatCurrency(row.amtOverdue)}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.dpd > 0 ? (
                          <span className={row.dpd > 90 ? "text-red-600 font-bold" : "text-amber-600 font-medium"}>
                            {row.dpd}
                          </span>
                        ) : (
                          "0"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.cfStatus === "Closed" ? "secondary"
                            : row.cfStatus === "NPA" ? "destructive"
                            : "outline"
                          }
                          className={row.cfStatus === "Standard" ? "text-green-700 border-green-300 bg-green-50" : ""}
                        >
                          {row.cfStatus}
                        </Badge>
                      </TableCell>
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
