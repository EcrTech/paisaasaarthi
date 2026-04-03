import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CreditCard, Search, Eye, Loader2, CheckCircle,
  Clock, XCircle, Upload, FileCheck, Ban
} from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useOrgContext } from "@/hooks/useOrgContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/common/PaginationControls";
import ProofUploadDialog from "@/components/LOS/Disbursement/ProofUploadDialog";
import DeclineDisbursementDialog from "@/components/LOS/Disbursement/DeclineDisbursementDialog";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

type UnifiedDisbursalItem = {
  id: string;
  application_id: string;
  loan_id: string | null;
  application_number: string;
  applicant_name: string;
  approved_amount: number;
  disbursed_amount: number;
  status: "ready" | "pending" | "completed" | "failed" | "declined";
  utr_number?: string;
  has_proof?: boolean;
  date: string;
  disbursement_number?: string;
  transaction_date?: string;
  // For single-step upload
  sanction_id?: string;
  bank_details?: {
    beneficiaryName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
  };
};

export default function Disbursals() {
  const navigate = useNavigate();
  const { orgId } = useOrgContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [uploadDialogItem, setUploadDialogItem] = useState<UnifiedDisbursalItem | null>(null);
  const [declineDialogItem, setDeclineDialogItem] = useState<UnifiedDisbursalItem | null>(null);

  // Fetch all disbursal data in a unified way
  const { data: allDisbursals, isLoading } = useQuery({
    queryKey: ["unified-disbursals", orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const unified: UnifiedDisbursalItem[] = [];

      // 1. Fetch applications ready for disbursal (all documents signed, no disbursement)
      const { data: applications } = await supabase
        .from("loan_applications")
        .select(`
          id,
          application_number,
          loan_id,
          approved_amount,
          current_stage,
          created_at,
          loan_sanctions!inner(id, processing_fee)
        `)
        .eq("org_id", orgId)
        .in("current_stage", ["approved", "disbursement"])
        .order("created_at", { ascending: false });

      if (applications) {
        for (const app of applications) {
          const { data: docs } = await supabase
            .from("loan_generated_documents")
            .select("document_type, customer_signed")
            .eq("loan_application_id", app.id);

          const combinedSigned = docs?.find(d => d.document_type === "combined_loan_pack")?.customer_signed;
          const sanctionSigned = docs?.find(d => d.document_type === "sanction_letter")?.customer_signed;
          const agreementSigned = docs?.find(d => d.document_type === "loan_agreement")?.customer_signed;
          const documentsReady = combinedSigned || (sanctionSigned && agreementSigned);

          // Check if disbursement already exists
          const { data: existingDisbursement } = await supabase
            .from("loan_disbursements")
            .select("id")
            .eq("loan_application_id", app.id)
            .maybeSingle();

          if (documentsReady && !existingDisbursement) {
            // Fetch applicant name
            const { data: applicants } = await supabase
              .from("loan_applicants")
              .select("first_name, last_name, bank_account_number, bank_ifsc_code, bank_name, bank_account_holder_name")
              .eq("loan_application_id", app.id)
              .eq("applicant_type", "primary")
              .order("bank_account_number", { ascending: false, nullsFirst: false })
              .limit(1);
            const applicant = applicants?.[0] || null;

            const sanction = Array.isArray(app.loan_sanctions) ? app.loan_sanctions[0] : app.loan_sanctions;
            const approvedAmount = Number(app.approved_amount) || 0;
            const processingFee = Number(sanction?.processing_fee) || Math.round(approvedAmount * 0.10);
            const gstOnPf = Math.round(processingFee * 0.18);
            const netAmount = approvedAmount - processingFee - gstOnPf;

            unified.push({
              id: app.id,
              application_id: app.id,
              loan_id: app.loan_id,
              application_number: app.application_number,
              applicant_name: applicant ? `${applicant.first_name} ${applicant.last_name || ""}`.trim() : "N/A",
              approved_amount: approvedAmount,
              disbursed_amount: netAmount,
              status: "ready",
              date: app.created_at,
              sanction_id: sanction?.id,
              bank_details: applicant?.bank_account_number ? {
                beneficiaryName: applicant.bank_account_holder_name || `${applicant.first_name} ${applicant.last_name || ""}`.trim(),
                accountNumber: applicant.bank_account_number,
                ifscCode: applicant.bank_ifsc_code || "",
                bankName: applicant.bank_name || "",
              } : undefined,
            });
          }
        }
      }

      // 2. Fetch all existing disbursements
      const { data: disbursements } = await supabase
        .from("loan_disbursements")
        .select(`
          *,
          loan_applications!inner(
            id,
            application_number,
            loan_id,
            approved_amount,
            org_id,
            loan_applicants(first_name, last_name, applicant_type)
          )
        `)
        .eq("loan_applications.org_id", orgId)
        .order("created_at", { ascending: false });

      if (disbursements) {
        for (const d of disbursements) {
          const primaryApplicant = d.loan_applications?.loan_applicants?.find(
            (a: { applicant_type: string }) => a.applicant_type === "primary"
          );
          
          unified.push({
            id: d.id,
            application_id: d.loan_application_id,
            loan_id: d.loan_applications?.loan_id || null,
            application_number: d.loan_applications?.application_number || "",
            applicant_name: primaryApplicant 
              ? `${primaryApplicant.first_name} ${primaryApplicant.last_name || ""}`.trim() 
              : "N/A",
            approved_amount: Number(d.loan_applications?.approved_amount) || 0,
            disbursed_amount: Number(d.disbursement_amount) || 0,
            status: d.status as "pending" | "completed" | "failed" | "declined",
            utr_number: d.utr_number,
            has_proof: !!d.proof_document_path,
            date: d.created_at,
            transaction_date: d.disbursement_date,
            disbursement_number: d.disbursement_number,
          });
        }
      }

      // Sort by date descending
      unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return unified;
    },
    enabled: !!orgId,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return (
          <Badge className="gap-1 bg-green-500">
            <FileCheck className="h-3 w-3" />
            Ready for Disbursal
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "completed":
        return (
          <Badge className="gap-1 bg-primary">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      case "declined":
        return (
          <Badge variant="destructive" className="gap-1">
            <Ban className="h-3 w-3" />
            Declined
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredDisbursals = useMemo(() => allDisbursals?.filter(d => {
    const matchesSearch =
      d.disbursement_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.applicant_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.application_number?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || d.status === statusFilter;

    return matchesSearch && matchesStatus;
  }) || [], [allDisbursals, searchQuery, statusFilter]);

  const pagination = usePagination({
    defaultPageSize: 100,
    totalRecords: filteredDisbursals.length,
  });

  const paginatedDisbursals = filteredDisbursals.slice(
    (pagination.currentPage - 1) * pagination.pageSize,
    pagination.currentPage * pagination.pageSize
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Disbursals</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>All Disbursals</CardTitle>
              <div className="flex gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ready">Ready for Disbursal</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredDisbursals.length > 0 ? (
              <div className="space-y-4">
                <div className="rounded-md border">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-foreground py-2 text-xs">Loan ID</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs">Application #</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs">Applicant</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs">Approved Amount</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs">Disbursed Amount</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs">Status</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs">UTR</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs">Transaction Date</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs">Proof</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedDisbursals.map((item) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/los/applications/${item.application_id}?tab=disbursement`)}
                      >
                        <TableCell className="font-mono text-sm text-primary">{item.loan_id || "-"}</TableCell>
                        <TableCell className="font-mono text-sm">{item.application_number}</TableCell>
                        <TableCell>{item.applicant_name}</TableCell>
                        <TableCell>{formatCurrency(item.approved_amount)}</TableCell>
                        <TableCell>
                          {item.status === "ready" ? "-" : formatCurrency(item.disbursed_amount)}
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell className="font-mono text-sm">{item.utr_number || "-"}</TableCell>
                        <TableCell>
                          {item.transaction_date 
                            ? format(new Date(item.transaction_date), "MMM dd, yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {item.has_proof ? (
                            <Badge variant="outline" className="gap-1 text-green-600">
                              <CheckCircle className="h-3 w-3" />
                              Uploaded
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.status === "ready" ? (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); setUploadDialogItem(item); }}
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => { e.stopPropagation(); setDeclineDialogItem(item); }}
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Decline
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); navigate(`/los/applications/${item.application_id}?tab=disbursement`); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
                <div className="px-2">
                  <PaginationControls
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    pageSize={pagination.pageSize}
                    totalRecords={filteredDisbursals.length}
                    startRecord={pagination.startRecord}
                    endRecord={pagination.endRecord}
                    onPageChange={pagination.setPage}
                    onPageSizeChange={pagination.setPageSize}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <CreditCard className="h-12 w-12 mb-2 opacity-50" />
                <p>No disbursals found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Single-step upload dialog */}
      {uploadDialogItem && (
        <ProofUploadDialog
          open={!!uploadDialogItem}
          onOpenChange={(open) => !open && setUploadDialogItem(null)}
          applicationId={uploadDialogItem.application_id}
          sanctionId={uploadDialogItem.sanction_id}
          disbursementAmount={uploadDialogItem.disbursed_amount}
          bankDetails={uploadDialogItem.bank_details}
        />
      )}

      {/* Decline disbursement dialog */}
      {declineDialogItem && (
        <DeclineDisbursementDialog
          open={!!declineDialogItem}
          onOpenChange={(open) => !open && setDeclineDialogItem(null)}
          applicationId={declineDialogItem.application_id}
          applicantName={declineDialogItem.applicant_name}
        />
      )}
    </DashboardLayout>
  );
}
