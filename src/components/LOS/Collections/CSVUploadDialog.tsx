import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import Papa from "papaparse";
import { CollectionRecord } from "@/hooks/useCollections";
import { getTodayIST } from "@/utils/loanCalculations";

interface CSVRow {
  loan_id: string;
  applicant: string;
  paid: string;
  utr_number: string;
}

interface MatchedRow extends CSVRow {
  matched: boolean;
  record?: CollectionRecord;
  error?: string;
}

interface CSVUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collections: CollectionRecord[];
  onRecordPayment: (data: {
    scheduleId: string;
    applicationId: string;
    paymentDate: string;
    paymentAmount: number;
    principalPaid: number;
    interestPaid: number;
    lateFeePaid: number;
    paymentMethod: string;
    transactionReference?: string;
  }) => void;
  isSubmitting: boolean;
}

export function CSVUploadDialog({
  open,
  onOpenChange,
  collections,
  onRecordPayment,
  isSubmitting,
}: CSVUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [matchedRows, setMatchedRows] = useState<MatchedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);

  const downloadTemplate = () => {
    const csv = "Loan ID,Applicant,Paid,UTR Number\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "collections_payment_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setResults(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => {
        const normalized = header.trim().toLowerCase().replace(/\s+/g, "_");
        if (normalized === "loan_id") return "loan_id";
        if (normalized === "applicant") return "applicant";
        if (normalized === "paid") return "paid";
        if (normalized === "utr_number" || normalized === "utr") return "utr_number";
        return normalized;
      },
      complete: (result) => {
        const rows = result.data as CSVRow[];
        const matched: MatchedRow[] = rows.map((row) => {
          // Find a pending/overdue schedule entry matching the loan_id
          const record = collections.find(
            (c) =>
              c.loan_id &&
              c.loan_id.toLowerCase() === row.loan_id?.trim()?.toLowerCase() &&
              c.status !== "paid"
          );

          if (!row.loan_id?.trim()) {
            return { ...row, matched: false, error: "Missing Loan ID" };
          }
          if (!row.paid?.trim() || isNaN(parseFloat(row.paid))) {
            return { ...row, matched: false, error: "Invalid amount" };
          }
          if (!record) {
            return { ...row, matched: false, error: "No pending record found" };
          }

          return { ...row, matched: true, record };
        });

        setMatchedRows(matched);
      },
    });

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirm = async () => {
    setProcessing(true);
    let success = 0;
    let failed = 0;

    for (const row of matchedRows) {
      if (!row.matched || !row.record) {
        failed++;
        continue;
      }

      try {
        const amount = parseFloat(row.paid);
        const principalRatio = row.record.principal / row.record.total_emi;
        const interestRatio = row.record.interest / row.record.total_emi;

        onRecordPayment({
          scheduleId: row.record.id,
          applicationId: row.record.loan_application_id,
          paymentDate: getTodayIST(),
          paymentAmount: amount,
          principalPaid: amount * principalRatio,
          interestPaid: amount * interestRatio,
          lateFeePaid: 0,
          paymentMethod: "neft",
          transactionReference: row.utr_number?.trim() || undefined,
        });
        success++;
      } catch {
        failed++;
      }
    }

    setResults({ success, failed });
    setProcessing(false);
  };

  const handleClose = () => {
    setMatchedRows([]);
    setFileName("");
    setResults(null);
    onOpenChange(false);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);

  const matchedCount = matchedRows.filter((r) => r.matched).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            CSV Bulk Payment Upload
          </DialogTitle>
        </DialogHeader>

        {matchedRows.length === 0 && !results ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Upload a CSV file</p>
              <p className="text-xs text-muted-foreground mt-1">
                Expected columns: Loan ID, Applicant, Paid, UTR Number
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Select CSV File
              </Button>
              <Button variant="ghost" size="sm" className="text-xs" onClick={downloadTemplate}>
                <FileText className="h-4 w-4 mr-1" />
                Download Template
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        ) : results ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Upload Complete</p>
              <div className="flex items-center justify-center gap-4 mt-2 text-sm">
                <span className="text-green-600">✓ {results.success} succeeded</span>
                {results.failed > 0 && (
                  <span className="text-destructive">✗ {results.failed} failed</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                File: <strong>{fileName}</strong>
              </span>
              <div className="flex gap-2">
                <Badge variant="secondary">{matchedRows.length} rows</Badge>
                <Badge className="bg-green-100 text-green-800">{matchedCount} matched</Badge>
                {matchedRows.length - matchedCount > 0 && (
                  <Badge variant="destructive">{matchedRows.length - matchedCount} errors</Badge>
                )}
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden max-h-[40vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs py-2">Loan ID</TableHead>
                    <TableHead className="text-xs py-2">Applicant</TableHead>
                    <TableHead className="text-xs py-2 text-right">Paid</TableHead>
                    <TableHead className="text-xs py-2">UTR Number</TableHead>
                    <TableHead className="text-xs py-2">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchedRows.map((row, idx) => (
                    <TableRow key={idx} className={row.matched ? "" : "bg-destructive/5"}>
                      <TableCell className="text-xs py-2">{row.loan_id}</TableCell>
                      <TableCell className="text-xs py-2">{row.applicant}</TableCell>
                      <TableCell className="text-xs py-2 text-right">
                        {row.paid && !isNaN(parseFloat(row.paid))
                          ? formatCurrency(parseFloat(row.paid))
                          : row.paid}
                      </TableCell>
                      <TableCell className="text-xs py-2">{row.utr_number || "—"}</TableCell>
                      <TableCell className="text-xs py-2">
                        {row.matched ? (
                          <Badge className="bg-green-100 text-green-800 text-[10px]">Matched</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {row.error}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {results ? "Close" : "Cancel"}
          </Button>
          {matchedRows.length > 0 && !results && (
            <Button
              onClick={handleConfirm}
              disabled={processing || isSubmitting || matchedCount === 0}
            >
              {processing ? "Processing..." : `Confirm ${matchedCount} Payments`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
