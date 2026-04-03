import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, CheckCircle, Loader2, Send, Upload, FileCheck, Filter, X, CalendarIcon, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { calculateLoanDetails, formatCurrency } from "@/utils/loanCalculations";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/common/PaginationControls";
import UploadSignedDocumentDialog from "@/components/LOS/Sanction/UploadSignedDocumentDialog";

interface SanctionApplication {
  id: string;
  application_number: string;
  loan_id: string | null;
  product_type: string;
  approved_amount: number;
  tenure_days: number;
  interest_rate: number;
  updated_at: string;
  applicant_name: string;
  applicant_email: string;
  sanction_id: string | null;
  sanction_status: string | null;
  sanction_number: string | null;
  documents_emailed_at: string | null;
  approver_name: string | null;
}

export default function Sanctions() {
  const { orgId } = useOrgContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [sanctioningId, setSanctioningId] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<SanctionApplication | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [approvedByFilter, setApprovedByFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Optimized: Single query with JOINs instead of 3 separate queries
  const { data: applications, isLoading } = useQuery({
    queryKey: ["approved-applications-with-sanctions", orgId],
    queryFn: async () => {
      // Fetch approved applications with related data in a single query
      const { data: applicationsData, error } = await supabase
        .from("loan_applications")
        .select(`
          *,
          loan_applicants!inner(first_name, last_name, email, applicant_type),
          loan_sanctions(id, status, sanction_number, documents_emailed_at),
          approved_by_profile:profiles!loan_applications_approved_by_fkey(first_name, last_name)
        `)
        .eq("org_id", orgId as string)
        .eq("status", "approved")
        .eq("loan_applicants.applicant_type", "primary")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      if (!applicationsData || applicationsData.length === 0) return [];

      // Transform the data
      return applicationsData.map((app: any) => {
        const applicant = app.loan_applicants?.[0];
        const sanction = app.loan_sanctions?.[0];
        const approverProfile = app.approved_by_profile;
        return {
          id: app.id,
          application_number: app.application_number,
          loan_id: app.loan_id || null,
          product_type: app.product_type,
          approved_amount: app.approved_amount,
          tenure_days: app.tenure_days,
          interest_rate: app.interest_rate,
          updated_at: app.updated_at,
          applicant_name: applicant
            ? [applicant.first_name, applicant.last_name].filter(Boolean).join(" ")
            : "N/A",
          applicant_email: applicant?.email || "",
          sanction_id: sanction?.id || null,
          sanction_status: sanction?.status || null,
          sanction_number: sanction?.sanction_number || null,
          documents_emailed_at: sanction?.documents_emailed_at || null,
          approver_name: approverProfile
            ? [approverProfile.first_name, approverProfile.last_name].filter(Boolean).join(" ")
            : null,
        };
      }) as SanctionApplication[];
    },
    enabled: !!orgId,
  });

  const sanctionMutation = useMutation({
    mutationFn: async (app: SanctionApplication) => {
      // If sanction already exists, skip creation
      if (app.sanction_id) {
        return { sanctionId: app.sanction_id };
      }

      const processingFee = Math.round(app.approved_amount * 0.1);
      const netDisbursement = app.approved_amount - processingFee;
      const sanctionNumber = `SAN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5)}`;

      const { data: newSanction, error: sanctionError } = await supabase
        .from("loan_sanctions")
        .insert({
          loan_application_id: app.id,
          sanction_number: sanctionNumber,
          sanction_date: new Date().toISOString().split('T')[0],
          sanctioned_amount: app.approved_amount,
          sanctioned_tenure_days: app.tenure_days,
          sanctioned_rate: app.interest_rate || 1,
          processing_fee: processingFee,
          gst_amount: Math.round(processingFee * 0.18),
          net_disbursement_amount: netDisbursement,
          validity_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'pending'
        })
        .select()
        .single();

      if (sanctionError) throw sanctionError;

      // Update application stage - guarded transition
      const { data: transitioned, error: stageError } = await supabase
        .rpc("transition_loan_stage", {
          p_application_id: app.id,
          p_expected_current_stage: "approved",
          p_new_stage: "disbursement",
        });
      
      if (stageError) throw stageError;
      if (!transitioned) throw new Error("Application stage has changed. Please refresh and try again.");

      return { sanctionId: newSanction.id };
    },
    onSuccess: () => {
      toast.success("Sanction created successfully!");
      queryClient.invalidateQueries({ queryKey: ["approved-applications-with-sanctions"] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });
      setSanctioningId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create sanction");
      setSanctioningId(null);
    }
  });

  const handleSanction = (app: SanctionApplication) => {
    setSanctioningId(app.id);
    sanctionMutation.mutate(app);
  };

  const handleUploadSigned = (app: SanctionApplication) => {
    setSelectedApp(app);
    setUploadDialogOpen(true);
  };

  const getStatusBadge = (app: SanctionApplication) => {
    if (app.sanction_status === 'signed') {
      return <Badge className="bg-green-500">Signed</Badge>;
    }
    if (app.documents_emailed_at) {
      return <Badge className="bg-blue-500">Emailed</Badge>;
    }
    if (app.sanction_id) {
      return <Badge variant="outline">Pending</Badge>;
    }
    return <Badge variant="secondary">New</Badge>;
  };

  const getAppStatus = (app: SanctionApplication): string => {
    if (app.sanction_status === 'signed') return 'signed';
    if (app.documents_emailed_at) return 'emailed';
    if (app.sanction_id) return 'pending';
    return 'new';
  };

  // Get unique approvers for filter dropdown
  const approvers = [...new Set(applications?.map(app => app.approver_name).filter(Boolean) || [])];

  const filteredApplications = useMemo(() => applications?.filter((app) => {
    // Search filter (name, loan_id, application_number)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesName = app.applicant_name?.toLowerCase().includes(search);
      const matchesLoanId = app.loan_id?.toLowerCase().includes(search);
      const matchesAppNumber = app.application_number?.toLowerCase().includes(search);
      if (!matchesName && !matchesLoanId && !matchesAppNumber) return false;
    }

    // Status filter
    if (statusFilter !== "all" && getAppStatus(app) !== statusFilter) return false;

    // Amount filter
    const minAmt = minAmount ? parseFloat(minAmount) : null;
    const maxAmt = maxAmount ? parseFloat(maxAmount) : null;
    if (minAmt && app.approved_amount < minAmt) return false;
    if (maxAmt && app.approved_amount > maxAmt) return false;

    // Date filter
    if (dateRange?.from) {
      const appDate = new Date(app.updated_at);
      if (appDate < dateRange.from) return false;
      if (dateRange.to && appDate > new Date(dateRange.to.setHours(23, 59, 59, 999))) return false;
    }

    // Approved by filter
    if (approvedByFilter !== "all" && app.approver_name !== approvedByFilter) return false;

    return true;
  }) || [], [applications, searchTerm, statusFilter, minAmount, maxAmount, dateRange, approvedByFilter]);

  const pagination = usePagination({
    defaultPageSize: 100,
    totalRecords: filteredApplications.length,
  });

  const paginatedApplications = filteredApplications.slice(
    (pagination.currentPage - 1) * pagination.pageSize,
    pagination.currentPage * pagination.pageSize
  );

  const hasActiveFilters = searchTerm || statusFilter !== "all" || minAmount || maxAmount || dateRange || approvedByFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setMinAmount("");
    setMaxAmount("");
    setDateRange(undefined);
    setApprovedByFilter("all");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sanctions</h1>
            <p className="text-muted-foreground">Approved applications pending sanction</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or loan number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-[250px]"
              />
            </div>

            <Filter className="h-4 w-4 text-muted-foreground ml-2" />

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="emailed">Emailed</SelectItem>
                <SelectItem value="signed">Signed</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Amount Range Filter */}
            <div className="flex items-center gap-1">
              <Input
                type="number"
                placeholder="Min ₹"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-[100px]"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="number"
                placeholder="Max ₹"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-[100px]"
              />
            </div>
            
            {/* Date Range Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                      </>
                    ) : (
                      format(dateRange.from, "MMM d, yyyy")
                    )
                  ) : (
                    <span className="text-muted-foreground">Date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            
            {/* Approved By Filter */}
            <Select value={approvedByFilter} onValueChange={setApprovedByFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Approved By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Approvers</SelectItem>
                {approvers.map((approver) => (
                  <SelectItem key={approver} value={approver!}>
                    {approver}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Approved Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Applications Found</h3>
                <p className="text-muted-foreground">
                  {statusFilter === "all" 
                    ? "No applications pending sanction at this time." 
                    : `No applications with "${statusFilter}" status.`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-foreground py-2 text-xs">Loan ID</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs">Application No.</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs">Applicant</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs">Loan Type</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs text-right">Approved Amount</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs text-right">Tenure</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs text-right">Interest Rate</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs text-right">Processing Fee</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs text-right">Net Disbursal</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs text-right">Total Interest</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs text-right">Total Repayment</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs">Approved By</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs">Status</TableHead>
                      <TableHead className="font-semibold text-foreground py-2 text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedApplications.map((app) => {
                      const loanCalc = calculateLoanDetails(
                        app.approved_amount || 0,
                        app.interest_rate || 1,
                        app.tenure_days || 0
                      );
                      const processingFee = Math.round((app.approved_amount || 0) * 0.1);
                      const netDisbursement = (app.approved_amount || 0) - processingFee;
                      const isSanctioning = sanctioningId === app.id;

                      return (
                        <TableRow 
                          key={app.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/los/sanctions/${app.id}`)}
                        >
                          <TableCell className="font-medium text-primary">
                            {app.loan_id || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {app.application_number}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div>{app.applicant_name}</div>
                              <div className="text-xs text-muted-foreground">{app.applicant_email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {app.product_type || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-primary">
                            {app.approved_amount ? formatCurrency(app.approved_amount) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {app.tenure_days ? `${app.tenure_days} days` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {app.interest_rate ? `${app.interest_rate}%` : "1%"}
                          </TableCell>
                          <TableCell className="text-right text-amber-600">
                            {formatCurrency(processingFee)}
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            {formatCurrency(netDisbursement)}
                          </TableCell>
                          <TableCell className="text-right text-red-500">
                            {formatCurrency(loanCalc.totalInterest)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(loanCalc.totalRepayment)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {app.approver_name || "—"}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(app)}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/los/sanctions/${app.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              
                              {!app.documents_emailed_at && (
                                <Button
                                  size="sm"
                                  onClick={() => handleSanction(app)}
                                  disabled={isSanctioning || !app.applicant_email}
                                  title={!app.applicant_email ? "Customer email required" : "Send sanction documents"}
                                >
                                  {isSanctioning ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Send className="h-4 w-4 mr-1" />
                                      Sanction
                                    </>
                                  )}
                                </Button>
                              )}
                              
                              {app.sanction_id && app.sanction_status !== 'signed' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUploadSigned(app)}
                                >
                                  <Upload className="h-4 w-4 mr-1" />
                                  Upload Signed
                                </Button>
                              )}
                              
                              {app.sanction_status === 'signed' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-green-600"
                                  disabled
                                >
                                  <FileCheck className="h-4 w-4 mr-1" />
                                  Completed
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
                <div className="px-2">
                  <PaginationControls
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    pageSize={pagination.pageSize}
                    totalRecords={filteredApplications.length}
                    startRecord={pagination.startRecord}
                    endRecord={pagination.endRecord}
                    onPageChange={pagination.setPage}
                    onPageSizeChange={pagination.setPageSize}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedApp && (
        <UploadSignedDocumentDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          applicationId={selectedApp.id}
          sanctionId={selectedApp.sanction_id!}
          orgId={orgId!}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["approved-applications-with-sanctions"] });
          }}
        />
      )}
    </DashboardLayout>
  );
}

// Generate Sanction Letter HTML
function generateSanctionLetterHtml(data: {
  sanctionNumber: string;
  customerName: string;
  applicationNumber: string;
  approvedAmount: number;
  tenure: number;
  interestRate: number;
  processingFee: number;
  netDisbursement: number;
  totalInterest: number;
  totalRepayment: number;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        .header { text-align: center; border-bottom: 2px solid #1a365d; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #1a365d; margin: 0; }
        .header p { color: #666; margin: 5px 0; }
        .content { line-height: 1.8; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .details-table td { padding: 10px; border: 1px solid #ddd; }
        .details-table td:first-child { background: #f8f9fa; font-weight: bold; width: 40%; }
        .amount { color: #059669; font-weight: bold; }
        .footer { margin-top: 50px; }
        .signature { margin-top: 100px; border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>SANCTION LETTER</h1>
        <p>Sanction No: ${data.sanctionNumber}</p>
        <p>Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
      </div>
      
      <div class="content">
        <p>Dear <strong>${data.customerName}</strong>,</p>
        
        <p>We are pleased to inform you that your loan application (Application No: <strong>${data.applicationNumber}</strong>) has been sanctioned. The details of the sanctioned loan are as follows:</p>
        
        <table class="details-table">
          <tr><td>Sanctioned Amount</td><td class="amount">₹${data.approvedAmount.toLocaleString('en-IN')}</td></tr>
          <tr><td>Loan Tenure</td><td>${data.tenure} Days</td></tr>
          <tr><td>Interest Rate</td><td>${data.interestRate}% per day</td></tr>
          <tr><td>Processing Fee (10%)</td><td>₹${data.processingFee.toLocaleString('en-IN')}</td></tr>
          <tr><td>Net Disbursement Amount</td><td class="amount">₹${data.netDisbursement.toLocaleString('en-IN')}</td></tr>
          <tr><td>Total Interest Payable</td><td>₹${data.totalInterest.toLocaleString('en-IN')}</td></tr>
          <tr><td>Total Repayment Amount</td><td>₹${data.totalRepayment.toLocaleString('en-IN')}</td></tr>
        </table>
        
        <p>This sanction is valid for 30 days from the date of issue. Please sign and return the Loan Agreement to proceed with disbursement.</p>
        
        <p><strong>Terms & Conditions:</strong></p>
        <ul>
          <li>The loan amount will be disbursed after receipt of signed loan agreement.</li>
          <li>Processing fee is non-refundable and will be deducted from the sanctioned amount.</li>
          <li>Any delay in EMI payment will attract penal charges as per the loan agreement.</li>
        </ul>
      </div>
      
      <div class="footer">
        <p>For any queries, please contact our loan department.</p>
        <div class="signature">Authorized Signatory</div>
      </div>
    </body>
    </html>
  `;
}

// Generate Loan Agreement HTML
function generateLoanAgreementHtml(data: {
  sanctionNumber: string;
  customerName: string;
  applicationNumber: string;
  approvedAmount: number;
  tenure: number;
  interestRate: number;
  processingFee: number;
  netDisbursement: number;
  totalInterest: number;
  totalRepayment: number;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #1a365d; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #1a365d; margin: 0; }
        h2 { color: #1a365d; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .details-table td { padding: 10px; border: 1px solid #ddd; }
        .details-table td:first-child { background: #f8f9fa; font-weight: bold; width: 40%; }
        .clause { margin: 15px 0; padding-left: 20px; }
        .signatures { display: flex; justify-content: space-between; margin-top: 80px; }
        .sign-box { text-align: center; width: 200px; }
        .sign-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 5px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>LOAN AGREEMENT</h1>
        <p>Agreement Reference: ${data.sanctionNumber}</p>
        <p>Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
      </div>
      
      <p>This Loan Agreement ("Agreement") is entered into on this day between:</p>
      <p><strong>LENDER:</strong> The Company (hereinafter referred to as "Lender")</p>
      <p><strong>BORROWER:</strong> ${data.customerName} (hereinafter referred to as "Borrower")</p>
      
      <h2>1. LOAN DETAILS</h2>
      <table class="details-table">
        <tr><td>Application Number</td><td>${data.applicationNumber}</td></tr>
        <tr><td>Loan Amount</td><td>₹${data.approvedAmount.toLocaleString('en-IN')}</td></tr>
        <tr><td>Tenure</td><td>${data.tenure} Days</td></tr>
        <tr><td>Interest Rate</td><td>${data.interestRate}% per day (Simple Interest)</td></tr>
        <tr><td>Processing Fee</td><td>₹${data.processingFee.toLocaleString('en-IN')}</td></tr>
        <tr><td>Net Disbursement</td><td>₹${data.netDisbursement.toLocaleString('en-IN')}</td></tr>
        <tr><td>Total Interest</td><td>₹${data.totalInterest.toLocaleString('en-IN')}</td></tr>
        <tr><td>Total Amount Payable</td><td>₹${data.totalRepayment.toLocaleString('en-IN')}</td></tr>
      </table>
      
      <h2>2. TERMS AND CONDITIONS</h2>
      <div class="clause"><strong>2.1</strong> The Borrower agrees to repay the loan amount along with interest as per the repayment schedule.</div>
      <div class="clause"><strong>2.2</strong> The processing fee is non-refundable and shall be deducted from the loan amount at the time of disbursement.</div>
      <div class="clause"><strong>2.3</strong> In case of delay in payment, penal interest @ 2% per day shall be applicable on the overdue amount.</div>
      <div class="clause"><strong>2.4</strong> The Borrower authorizes the Lender to recover the dues through any legal means in case of default.</div>
      <div class="clause"><strong>2.5</strong> Prepayment of loan is allowed without any prepayment charges after completion of minimum tenure.</div>
      
      <h2>3. DECLARATION</h2>
      <p>The Borrower hereby declares that all information provided is true and correct. The Borrower has read, understood, and agrees to all terms and conditions of this Agreement.</p>
      
      <div class="signatures">
        <div class="sign-box">
          <div class="sign-line">Borrower's Signature</div>
          <p>${data.customerName}</p>
        </div>
        <div class="sign-box">
          <div class="sign-line">Lender's Signature</div>
          <p>Authorized Signatory</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
